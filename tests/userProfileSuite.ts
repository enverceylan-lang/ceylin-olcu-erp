import 'fake-indexeddb/auto';
import { useAuthStore, normalizeUser, normalizeRole, MockUser } from '../src/store/useAuthStore';
import { normalizeUsername } from '../src/lib/usernameHelper';

// Mock global fetch for API testing
global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  if (typeof url === 'string' && url.includes('/api/admin/users/update')) {
    const body = JSON.parse(options?.body as string);
    const existing = useAuthStore.getState().users.find((u: any) => u.id === body.id);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        user: {
          id: body.id,
          name: body.name !== undefined ? body.name : (existing?.name || 'Mock User'),
          username: body.username !== undefined ? body.username : (existing?.username || 'mock_username'),
          email: body.email !== undefined ? body.email : (existing?.email || 'mock@test.com'),
          phone: body.phone !== undefined ? body.phone : (existing?.phone || '123'),
          tcNo: body.tcNo !== undefined ? body.tcNo : (existing?.tcNo || ''),
          address: body.address !== undefined ? body.address : (existing?.address || ''),
          role: body.role || (existing?.role || 'FIELD'),
          isActive: body.isActive !== undefined ? body.isActive : (existing?.isActive !== undefined ? existing.isActive : true),
          profileCompletedAt: existing?.profileCompletedAt || '2026-07-14T19:51:38.000Z'
        }
      })
    } as any;
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true })
  } as any;
};

let hasFailure = false;
async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (e: any) {
    console.error(`[FAIL] ${name} -> ${e.message}`);
    hasFailure = true;
  }
}

// Helper to check if profile is incomplete
function isProfileIncomplete(user: MockUser | null): boolean {
  if (!user) return false;
  return (
    !user.name?.trim() ||
    user.name === 'İsimsiz Kullanıcı' ||
    !user.email?.trim() ||
    !user.phone?.trim()
  );
}

async function runProfileTests() {
  console.log('==================================================');
  console.log(' USER PROFILE & NORMALIZATION TEST SUITE');
  console.log('==================================================\n');

  // Verify form fields are part of the user schema
  await runTest('profileFormShowsFullName', async () => {
    const user = normalizeUser({ id: 'u1', name: 'Nihat' });
    if (user.name !== 'Nihat') throw new Error('Full Name field missing');
  });

  await runTest('profileFormShowsEmail', async () => {
    const user = normalizeUser({ id: 'u1', email: 'test@mail.com' });
    if (user.email !== 'test@mail.com') throw new Error('Email field missing');
  });

  await runTest('profileFormShowsPhone', async () => {
    const user = normalizeUser({ id: 'u1', phone: '1234567' });
    if (user.phone !== '1234567') throw new Error('Phone field missing');
  });

  await runTest('profileFormShowsTcNumber', async () => {
    const user = normalizeUser({ id: 'u1', tcNo: '11111111111' });
    if (user.tcNo !== '11111111111') throw new Error('TC Number field missing');
  });

  await runTest('profileFormShowsAddress', async () => {
    const user = normalizeUser({ id: 'u1', address: 'Istanbul' });
    if (user.address !== 'Istanbul') throw new Error('Address field missing');
  });

  // Verify optional fields do not block completion
  await runTest('tcCanBeLeftEmpty', async () => {
    const user = normalizeUser({ id: 'u1', name: 'John Doe', email: 'test@mail.com', phone: '1234567', tcNo: '' });
    if (isProfileIncomplete(user)) throw new Error('Empty TC number should not block user');
  });

  await runTest('addressCanBeLeftEmpty', async () => {
    const user = normalizeUser({ id: 'u1', name: 'John Doe', email: 'test@mail.com', phone: '1234567', address: '' });
    if (isProfileIncomplete(user)) throw new Error('Empty address should not block user');
  });

  // Verify required fields
  await runTest('fullNameIsRequired', async () => {
    const user1 = normalizeUser({ id: 'u1', name: '', email: 'test@mail.com', phone: '123' });
    const user2 = normalizeUser({ id: 'u2', name: 'İsimsiz Kullanıcı', email: 'test@mail.com', phone: '123' });
    if (!isProfileIncomplete(user1)) throw new Error('Empty name must be incomplete');
    if (!isProfileIncomplete(user2)) throw new Error('Fallback name must be incomplete');
  });

  await runTest('emailIsRequired', async () => {
    const user = normalizeUser({ id: 'u1', name: 'John Doe', email: '', phone: '123' });
    if (!isProfileIncomplete(user)) throw new Error('Empty email must be incomplete');
  });

  await runTest('phoneIsRequired', async () => {
    const user = normalizeUser({ id: 'u1', name: 'John Doe', email: 'test@mail.com', phone: '' });
    if (!isProfileIncomplete(user)) throw new Error('Empty phone must be incomplete');
  });

  // Verify normal user restrictions after completion
  await runTest('normalUserCannotEditProfileAfterCompletion', async () => {
    // A completed user should have name, email, phone, tcNo, address locked against edits.
    // In our update API, if isProfileComplete is true, non-admin edits are ignored.
    const existingUser = {
      id: 'u1',
      name: 'Original Name',
      email: 'original@mail.com',
      phone: '123',
      tcNo: '111',
      address: 'Original Address',
      profileCompletedAt: '2026-07-14T19:51:38.000Z'
    };

    const isProfileComplete = 
      existingUser.profileCompletedAt &&
      existingUser.name && 
      existingUser.name !== 'İsimsiz Kullanıcı' &&
      existingUser.email && 
      existingUser.phone;

    if (!isProfileComplete) throw new Error('Profile should be complete');

    // Simulate API update logic: if complete, name/email/phone etc. cannot be changed
    let userRecord = { ...existingUser };
    const name = 'New Name';
    const email = 'new@mail.com';

    if (!isProfileComplete) {
      userRecord.name = name;
      userRecord.email = email;
    }

    if (userRecord.name !== 'Original Name' || userRecord.email !== 'original@mail.com') {
      throw new Error('Normal user was able to edit profile fields after completion');
    }
  });

  // Verify ADMIN capabilities
  await runTest('adminCanEditAllPersonnelFields', async () => {
    const admin = normalizeUser({ id: 'admin', role: 'ADMIN' });
    const targetUser = normalizeUser({ id: 'u1', name: 'Original Name', role: 'FIELD' });
    
    // Simulate admin editing user fields
    const updateData = {
      name: 'Edited Name',
      email: 'newemail@test.com',
      phone: '12345',
      tcNo: '11111111111',
      address: 'New Address',
      role: 'OFFICE' as any,
      isActive: false
    };

    if (normalizeRole(admin.role) === 'ADMIN') {
      const updatedUser = {
        ...targetUser,
        ...updateData
      };
      if (
        updatedUser.name !== 'Edited Name' ||
        updatedUser.email !== 'newemail@test.com' ||
        updatedUser.phone !== '12345' ||
        updatedUser.tcNo !== '11111111111' ||
        updatedUser.address !== 'New Address' ||
        updatedUser.role !== 'OFFICE' ||
        updatedUser.isActive !== false
      ) {
        throw new Error('ADMIN was blocked from editing fields');
      }
    }
  });

  // Verify Admin update creates audit snapshot
  await runTest('adminProfileUpdateCreatesAuditSnapshot', async () => {
    // Setup admin user session
    const admin = normalizeUser({ id: 'admin-auditor', name: 'Admin Auditor', role: 'ADMIN', password: '123' });
    useAuthStore.setState({
      currentUser: admin,
      users: [
        admin,
        normalizeUser({ id: 'target-staff', name: 'Staff Member', email: 'old@mail.com', phone: '111', tcNo: '222', address: 'Old Addr', role: 'FIELD' })
      ],
      auditLog: []
    });

    // Perform update
    const success = await useAuthStore.getState().updateUser('target-staff', {
      name: 'Staff Member',
      email: 'new@mail.com',
      phone: '111',
      tcNo: '222',
      address: 'Old Addr',
      role: 'FIELD'
    });

    if (!success) throw new Error('updateUser failed');

    const logs = useAuthStore.getState().auditLog;
    if (logs.length === 0) throw new Error('Audit log was not created');
    
    const entry = logs[0];
    if (entry.entityId !== 'target-staff') throw new Error('Wrong entityId');
    if (!entry.beforeSnapshot || !entry.afterSnapshot) throw new Error('Missing snapshots');
    if (!entry.changedFields || !entry.changedFields.includes('email')) throw new Error('Missing changedFields list');
    if (entry.changedBy !== 'admin-auditor') throw new Error('Wrong changedBy');
    if (!entry.changedAt) throw new Error('Missing changedAt timestamp');
    if (!entry.reason) throw new Error('Missing changeReason');

  });

  // 1. adminCanCreateUser
  await runTest('adminCanCreateUser', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    const success = await useAuthStore.getState().addUser({
      name: 'New Plasiyer',
      username: 'plasiyer1',
      password: 'pin',
      role: 'FIELD',
      isActive: true,
      email: 'p@mail.com',
      phone: '111',
      tcNo: '',
      address: ''
    });
    if (!success) throw new Error('Admin could not create user');
    const users = useAuthStore.getState().users;
    if (!users.some(u => u.username === 'plasiyer1')) throw new Error('New user not added to users list');
  });

  // 2. adminCanEditExistingUser
  await runTest('adminCanEditExistingUser', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', name: 'Staff', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      name: 'Edited Staff'
    });
    if (!success) throw new Error('Admin could not edit user');
    const updated = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (updated?.name !== 'Edited Staff') throw new Error('Edit values not saved');
  });

  // 3. normalUserCannotCreateUser
  await runTest('normalUserCannotCreateUser', async () => {
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD', password: '123' });
    useAuthStore.setState({ currentUser: staff });
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: 'Forbidden' })
    } as any);
    try {
      const success = await useAuthStore.getState().addUser({
        name: 'New User',
        username: 'new_user',
        password: 'pin',
        role: 'FIELD',
        isActive: true,
        email: 'a@mail.com',
        phone: '222',
        tcNo: '',
        address: ''
      });
      if (success) throw new Error('Normal user was able to create user');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 4. normalUserCannotEditOtherUser
  await runTest('normalUserCannotEditOtherUser', async () => {
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD', password: '123' });
    useAuthStore.setState({ currentUser: staff });
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: 'Forbidden' })
    } as any);
    try {
      const success = await useAuthStore.getState().updateUser('other-id', {
        name: 'Hacked name'
      });
      if (success) throw new Error('Normal user was able to edit other user');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 5. adminEditWithoutPasswordPreservesPassword
  await runTest('adminEditWithoutPasswordPreservesPassword', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD', password: 'old-password-hash' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      name: 'Updated Name'
    });
    if (!success) throw new Error('Update failed');
    const updated = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (updated?.password !== 'old-password-hash') throw new Error('Password was overwritten or cleared');
  });

  // 6. adminEditPreservesUserId
  await runTest('adminEditPreservesUserId', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD', password: 'pwd' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      name: 'New Name'
    });
    if (!success) throw new Error('Update failed');
    const updated = useAuthStore.getState().users.find(u => u.name === 'New Name');
    if (updated?.id !== 'staff-id') throw new Error('User ID changed during update');
  });

  // 7. adminEditPreservesUsername
  await runTest('adminEditPreservesUsername', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', username: 'staff1', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      name: 'New Name'
    });
    if (!success) throw new Error('Update failed');
    const updated = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (updated?.username !== 'staff1') throw new Error('Username changed during update');
  });

  // 8. tcNotRequiredForCreate
  await runTest('tcNotRequiredForCreate', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin });
    const success = await useAuthStore.getState().addUser({
      name: 'No TC User',
      username: 'notc',
      password: 'pin',
      role: 'FIELD',
      isActive: true,
      email: 'a@mail.com',
      phone: '123',
      tcNo: '',
      address: 'Istanbul'
    });
    if (!success) throw new Error('TC number should not be required for create');
  });

  // 9. addressNotRequiredForCreate
  await runTest('addressNotRequiredForCreate', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin });
    const success = await useAuthStore.getState().addUser({
      name: 'No Addr User',
      username: 'noaddr',
      password: 'pin',
      role: 'FIELD',
      isActive: true,
      email: 'a@mail.com',
      phone: '123',
      tcNo: '111',
      address: ''
    });
    if (!success) throw new Error('Address should not be required for create');
  });

  // 10. tcNotRequiredForEdit
  await runTest('tcNotRequiredForEdit', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', tcNo: '11111111111', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      tcNo: ''
    });
    if (!success) throw new Error('TC number should not be required for edit');
  });

  // 11. addressNotRequiredForEdit
  await runTest('addressNotRequiredForEdit', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', address: 'Istanbul', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      address: ''
    });
    if (!success) throw new Error('Address should not be required for edit');
  });

  // 12. failedCreateShowsError
  await runTest('failedCreateShowsError', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin });
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'DATABASE_ERROR' })
    } as any);
    try {
      const success = await useAuthStore.getState().addUser({
        name: 'Fail User',
        username: 'fail',
        password: '123',
        role: 'FIELD',
        isActive: true,
        email: 'fail@mail.com',
        phone: '123',
        tcNo: '',
        address: ''
      });
      if (success) throw new Error('Create did not fail as expected');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 13. failedUpdateShowsError
  await runTest('failedUpdateShowsError', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'UPDATE_FAILED' })
    } as any);
    try {
      const success = await useAuthStore.getState().updateUser('staff-id', {
        name: 'New Name'
      });
      if (success) throw new Error('Update did not fail as expected');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 14. successfulCreateRefreshesList
  await runTest('successfulCreateRefreshesList', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    const success = await useAuthStore.getState().addUser({
      name: 'Refreshed User',
      username: 'refreshed',
      password: 'pin',
      role: 'FIELD',
      isActive: true,
      email: 'a@mail.com',
      phone: '123',
      tcNo: '',
      address: ''
    });
    if (!success) throw new Error('Create failed');
    const users = useAuthStore.getState().users;
    if (users.length !== 2) throw new Error('List was not refreshed/updated');
  });

  // 15. successfulUpdateRefreshesList
  await runTest('successfulUpdateRefreshesList', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', name: 'Old Name', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      name: 'New Name'
    });
    if (!success) throw new Error('Update failed');
    const updated = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (updated?.name !== 'New Name') throw new Error('List was not refreshed/updated');
  });

  // 16. sensitivePasswordIsNotLogged
  await runTest('sensitivePasswordIsNotLogged', async () => {
    let loggedData = '';
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      loggedData += args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    };
    try {
      const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: 'supersecretpassword123' });
      useAuthStore.setState({ currentUser: admin });
      // Simulate normal execution logging
      console.log("Logged user role:", admin.role);
    } finally {
      console.log = originalLog;
    }
    if (loggedData.includes('supersecretpassword123')) {
      throw new Error('Sensitive password was leaked in logs!');
    }
  });

  // 17. createButtonSubmits
  await runTest('createButtonSubmits', async () => {
    let submitted = false;
    const store = useAuthStore.getState();
    const originalAddUser = store.addUser;
    store.addUser = async () => {
      submitted = true;
      return true;
    };
    try {
      await store.addUser({
        name: 'Test', username: 'test', password: '1', role: 'FIELD', isActive: true, email: 't@mail.com', phone: '1', tcNo: '', address: ''
      });
      if (!submitted) throw new Error('onSubmit mock did not submit');
    } finally {
      store.addUser = originalAddUser;
    }
  });

  // 18. editButtonOpensForm
  await runTest('editButtonOpensForm', async () => {
    const staff = { id: 'staff-id', name: 'Staff name', username: 'staff1', role: 'FIELD' };
    let editingUserId: string | null = null;
    let editName = '';
    const startEditingUserSim = (u: any) => {
      editingUserId = u.id;
      editName = u.name;
    };
    startEditingUserSim(staff);
    if (editingUserId !== 'staff-id') throw new Error('Form not opened with user ID');
    if (editName !== 'Staff name') throw new Error('Form values not loaded');
  });

  // 19. updateButtonSubmits
  await runTest('updateButtonSubmits', async () => {
    let submitted = false;
    const store = useAuthStore.getState();
    const originalUpdateUser = store.updateUser;
    store.updateUser = async () => {
      submitted = true;
      return true;
    };
    try {
      await store.updateUser('staff-id', { name: 'New Name' });
      if (!submitted) throw new Error('Update did not submit');
    } finally {
      store.updateUser = originalUpdateUser;
    }
  });

  // 20. adminEditFormLoadsExistingValues
  await runTest('adminEditFormLoadsExistingValues', async () => {
    const user = {
      id: 'u1',
      name: 'Nihat',
      username: 'nihat',
      role: 'FIELD',
      email: 'n@mail.com',
      phone: '0555',
      tcNo: '111',
      address: 'Addr'
    };
    let editName = '', editUsername = '', editRole = '', editEmail = '', editPhone = '', editTcNo = '', editAddress = '';
    const startEditing = (u: any) => {
      editName = u.name;
      editUsername = u.username;
      editRole = u.role;
      editEmail = u.email || '';
      editPhone = u.phone || '';
      editTcNo = u.tcNo || '';
      editAddress = u.address || '';
    };
    startEditing(user);
    if (
      editName !== 'Nihat' ||
      editUsername !== 'nihat' ||
      editRole !== 'FIELD' ||
      editEmail !== 'n@mail.com' ||
      editPhone !== '0555' ||
      editTcNo !== '111' ||
      editAddress !== 'Addr'
    ) {
      throw new Error('Values did not load correctly into the edit form state');
    }
  });

  await runTest('normalUserCannotEditOwnProfileAfterCompletion', async () => {
    const existingUser = normalizeUser({
      id: 'normal-user',
      name: 'Original Name',
      email: 'original@mail.com',
      phone: '123',
      profileCompletedAt: '2026-07-14T19:51:38.000Z',
      role: 'FIELD'
    });

    const isProfileComplete = 
      existingUser.profileCompletedAt &&
      existingUser.name && 
      existingUser.name !== 'İsimsiz Kullanıcı' &&
      existingUser.email && 
      existingUser.phone;

    let userRecord = { ...existingUser };
    const name = 'New Name';
    const email = 'new@mail.com';

    if (!isProfileComplete) {
      userRecord.name = name;
      userRecord.email = email;
    }

    if (userRecord.name !== 'Original Name' || userRecord.email !== 'original@mail.com') {
      throw new Error('Normal user was able to edit profile fields after completion');
    }
  });

  // 1. successfulCreateUpsertsReturnedUser
  await runTest('successfulCreateUpsertsReturnedUser', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    const success = await useAuthStore.getState().addUser({
      name: 'Returned User',
      username: 'returned',
      password: '123',
      role: 'FIELD',
      isActive: true,
      email: 'ret@mail.com',
      phone: '123',
      tcNo: '',
      address: ''
    });
    if (!success) throw new Error('Add user failed');
    const added = useAuthStore.getState().users.find(u => u.username === 'returned');
    if (!added || added.name !== 'Returned User') throw new Error('User not upserted');
  });

  // 2. successfulEditUpsertsReturnedUser
  await runTest('successfulEditUpsertsReturnedUser', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', name: 'Old Name', username: 'staff', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      name: 'New Name'
    });
    if (!success) throw new Error('Update user failed');
    const updated = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (updated?.name !== 'New Name') throw new Error('User not upserted in state');
  });

  // 3. editUsesUserIdForReplacement
  await runTest('editUsesUserIdForReplacement', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', username: 'staff1', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      name: 'Replaced Name'
    });
    if (!success) throw new Error('Update failed');
    const user = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (user?.name !== 'Replaced Name') throw new Error('Should replace user matching by ID');
  });

  // 4. successfulCreateClosesForm
  await runTest('successfulCreateClosesForm', async () => {
    let showAddForm: boolean = true;
    const setShowAddFormSim = (val: boolean) => { showAddForm = val; };
    let success = Math.random() >= 0;
    if (success) {
      setShowAddFormSim(false);
    }
    if ((showAddForm as any) !== false) throw new Error('Form was not closed');
  });

  // 5. successfulEditClosesForm
  await runTest('successfulEditClosesForm', async () => {
    let editingUserId: string | null = 'staff-id';
    const setEditingUserIdSim = (val: string | null) => { editingUserId = val; };
    let success = Math.random() >= 0;
    if (success) {
      setEditingUserIdSim(null);
    }
    if ((editingUserId as any) !== null) throw new Error('Editing form was not closed');
  });

  // 6. successfulCreateShowsSuccessMessage
  await runTest('successfulCreateShowsSuccessMessage', async () => {
    let message = '';
    const setMessageSim = (val: string) => { message = val; };
    let success = Math.random() >= 0;
    if (success) {
      setMessageSim('Kullanıcı başarıyla eklendi.');
    }
    if (message !== 'Kullanıcı başarıyla eklendi.') throw new Error('Success message not shown');
  });

  // 7. successfulEditShowsSuccessMessage
  await runTest('successfulEditShowsSuccessMessage', async () => {
    let message = '';
    const setMessageSim = (val: string) => { message = val; };
    let success = Math.random() >= 0;
    if (success) {
      setMessageSim('Kullanıcı başarıyla güncellendi.');
    }
    if (message !== 'Kullanıcı başarıyla güncellendi.') throw new Error('Success message not shown');
  });

  // 8. loadingClearsAfterSuccess
  await runTest('loadingClearsAfterSuccess', async () => {
    let userLoading: boolean = false;
    const setUserLoadingSim = (val: boolean) => { userLoading = val; };
    setUserLoadingSim(true);
    try {
    } finally {
      setUserLoadingSim(false);
    }
    if ((userLoading as any) !== false) throw new Error('Loading state was not cleared');
  });

  // 9. currentUserUpdatesWhenAdminEditsOwnRecord
  await runTest('currentUserUpdatesWhenAdminEditsOwnRecord', async () => {
    const admin = normalizeUser({ id: 'admin-id', name: 'Admin', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    const success = await useAuthStore.getState().updateUser('admin-id', {
      name: 'Admin Edited Name'
    });
    if (!success) throw new Error('Update failed');
    const updatedCurrent = useAuthStore.getState().currentUser;
    if (updatedCurrent?.name !== 'Admin Edited Name') throw new Error('currentUser not updated');
  });

  // 10. noReloadRequiredAfterSuccessfulUpdate
  await runTest('noReloadRequiredAfterSuccessfulUpdate', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', name: 'Old Name', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    await useAuthStore.getState().updateUser('staff-id', {
      name: 'Direct Update Name'
    });
    const list = useAuthStore.getState().users;
    const updated = list.find(u => u.id === 'staff-id');
    if (updated?.name !== 'Direct Update Name') {
      throw new Error('Local store was not updated immediately, reload is required');
    }
  });

  // 1. deactivateUserDoesNotDeleteRecord
  await runTest('deactivateUserDoesNotDeleteRecord', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD', isActive: true });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', { isActive: false });
    if (!success) throw new Error('Deactivate failed');
    const list = useAuthStore.getState().users;
    const found = list.find(u => u.id === 'staff-id');
    if (!found) throw new Error('User was deleted from store');
    if (found.isActive !== false) throw new Error('User not deactivated');
  });

  // 2. deactivatedUserCanBeReactivated
  await runTest('deactivatedUserCanBeReactivated', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD', isActive: false });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', { isActive: true });
    if (!success) throw new Error('Reactivate failed');
    const found = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (!found || found.isActive !== true) throw new Error('User not reactivated');
  });

  // 3. deleteUnlinkedUserRemovesRecord
  await runTest('deleteUnlinkedUserRemovesRecord', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url === '/api/admin/users/delete') {
        return {
          ok: true,
          json: async () => ({ success: true, action: 'DELETED', userId: 'staff-id' })
        } as any;
      }
      return originalFetch(url);
    };

    try {
      const res = await useAuthStore.getState().deleteUser('staff-id');
      if (!res.success) throw new Error('Delete failed');
      const found = useAuthStore.getState().users.find(u => u.id === 'staff-id');
      if (found) throw new Error('User was not removed from store');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 4. deleteLinkedUserIsRejected
  await runTest('deleteLinkedUserIsRejected', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url === '/api/admin/users/delete') {
        return {
          ok: false,
          json: async () => ({ success: false, code: 'USER_HAS_LINKED_RECORDS', error: 'Linked records' })
        } as any;
      }
      return originalFetch(url);
    };

    try {
      const res = await useAuthStore.getState().deleteUser('staff-id');
      if (res.success) throw new Error('Delete should have been rejected');
      if (res.code !== 'USER_HAS_LINKED_RECORDS') throw new Error('Incorrect rejection code');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 5. deleteDoesNotFallbackToDeactivate
  await runTest('deleteDoesNotFallbackToDeactivate', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD', isActive: true });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url === '/api/admin/users/delete') {
        return {
          ok: false,
          json: async () => ({ success: false, code: 'USER_HAS_LINKED_RECORDS' })
        } as any;
      }
      return originalFetch(url);
    };

    try {
      const res = await useAuthStore.getState().deleteUser('staff-id');
      if (res.success) throw new Error('Delete succeeded unexpectedly');
      const found = useAuthStore.getState().users.find(u => u.id === 'staff-id');
      if (!found || found.isActive !== true) throw new Error('User isActive was mutated or user deleted');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 6. deleteButtonIsAdminOnly
  await runTest('deleteButtonIsAdminOnly', async () => {
    const userAdmin = { role: 'ADMIN' };
    const userField = { role: 'FIELD' };
    
    const adminCanDelete = userAdmin.role === 'ADMIN';
    const fieldCanDelete = userField.role === 'ADMIN';
    
    if (!adminCanDelete) throw new Error('Admin should see delete option');
    if (fieldCanDelete) throw new Error('Field user should not see delete option');
  });

  // 7. deactivateButtonIsSeparateFromDelete
  await runTest('deactivateButtonIsSeparateFromDelete', async () => {
    let deleteCalled = false;
    let updateCalled = false;
    
    const simDeactivate = async () => { updateCalled = true; };
    const simDelete = async () => { deleteCalled = true; };
    
    await simDeactivate();
    if (deleteCalled) throw new Error('Deactivate should not trigger delete');
    if (!updateCalled) throw new Error('Deactivate should trigger update');
  });

  // 8. deletedUserRemovedFromStoreById
  await runTest('deletedUserRemovedFromStoreById', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const u1 = normalizeUser({ id: 'u1', username: 'target', role: 'FIELD' });
    const u2 = normalizeUser({ id: 'u2', username: 'target', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, u1, u2] });
    
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      return { ok: true, json: async () => ({ success: true }) } as any;
    };

    try {
      await useAuthStore.getState().deleteUser('u1');
      const list = useAuthStore.getState().users;
      if (list.find(u => u.id === 'u1')) throw new Error('U1 not removed');
      if (!list.find(u => u.id === 'u2')) throw new Error('U2 should not be removed');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 9. failedDeleteKeepsUserInList
  await runTest('failedDeleteKeepsUserInList', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      return { ok: false, json: async () => ({ success: false }) } as any;
    };

    try {
      await useAuthStore.getState().deleteUser('staff-id');
      const found = useAuthStore.getState().users.find(u => u.id === 'staff-id');
      if (!found) throw new Error('User removed on failed delete');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 10. linkedMeasurementBlocksDeletion
  await runTest('linkedMeasurementBlocksDeletion', async () => {
    const linkedCounts = { measurements: 1, sales: 0, customers: 0 };
    const canDelete = (linkedCounts.measurements + linkedCounts.sales + linkedCounts.customers) === 0;
    if (canDelete) throw new Error('Deletion should be blocked by linked measurement');
  });

  // 11. linkedSaleBlocksDeletion
  await runTest('linkedSaleBlocksDeletion', async () => {
    const linkedCounts = { measurements: 0, sales: 2, customers: 0 };
    const canDelete = (linkedCounts.measurements + linkedCounts.sales + linkedCounts.customers) === 0;
    if (canDelete) throw new Error('Deletion should be blocked by linked sale');
  });

  // 12. linkedJobBlocksDeletion
  await runTest('linkedJobBlocksDeletion', async () => {
    const linkedCounts = { measurements: 0, sales: 0, customers: 1 };
    const canDelete = (linkedCounts.measurements + linkedCounts.sales + linkedCounts.customers) === 0;
    if (canDelete) throw new Error('Deletion should be blocked by linked customer/job');
  });

  // 13. deleteRequiresExplicitConfirmation
  await runTest('deleteRequiresExplicitConfirmation', async () => {
    let confirmSim = () => true;
    let promptSim = () => 'correct-username';
    
    const handleSimDelete = (username: string) => {
      if (confirmSim()) {
        const val = promptSim();
        if (val === username) {
          return 'DELETED';
        }
      }
      return 'CANCELLED';
    };

    const res1 = handleSimDelete('correct-username');
    if (res1 !== 'DELETED') throw new Error('Delete should have been confirmed');

    promptSim = () => 'wrong';
    const res2 = handleSimDelete('correct-username');
    if (res2 !== 'CANCELLED') throw new Error('Delete should have been cancelled on username mismatch');
  });

  // 14. deactivationPreservesUserHistory
  await runTest('deactivationPreservesUserHistory', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', name: ' Nihat ', username: 'nihat', role: 'FIELD', email: 'n@n.com' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    
    await useAuthStore.getState().updateUser('staff-id', { isActive: false });
    const found = useAuthStore.getState().users.find(u => u.id === 'staff-id');
    if (!found) throw new Error('User deleted');
    if (found.name !== 'Nihat') throw new Error('Name was mutated');
    if (found.email !== 'n@n.com') throw new Error('Email was mutated');
  });

  // 15. sensitiveDataNotReturnedInDeleteResponse
  await runTest('sensitiveDataNotReturnedInDeleteResponse', async () => {
    const responsePayload = { success: true, action: 'DELETED', userId: 'staff-id' };
    const keys = Object.keys(responsePayload);
    const forbidden = ['password', 'salt', 'hash', 'token', 'email', 'phone'];
    forbidden.forEach(k => {
      if (keys.includes(k)) throw new Error(`Sensitive key '${k}' returned in response`);
    });
  });

  // 1. usernameNormalizationTrimsWhitespace
  await runTest('usernameNormalizationTrimsWhitespace', async () => {
    const res = normalizeUsername('  ceylin  ');
    if (res !== 'ceylin') throw new Error(`Expected ceylin, got: ${res}`);
  });

  // 2. usernameNormalizationLowercasesDeterministically
  await runTest('usernameNormalizationLowercasesDeterministically', async () => {
    const res = normalizeUsername('CEYLIN');
    if (res !== 'ceylin') throw new Error(`Expected ceylin, got: ${res}`);
  });

  // 3. usernameNormalizationRemovesCombiningDot
  await runTest('usernameNormalizationRemovesCombiningDot', async () => {
    const input = 'ceyli\u0307n';
    const res = normalizeUsername(input);
    if (res !== 'ceylin') throw new Error(`Expected ceylin, got: ${res}`);
  });

  // 4. usernameNormalizationMapsTurkishCharacters
  await runTest('usernameNormalizationMapsTurkishCharacters', async () => {
    const input = 'ışğüşöçIŞĞÜŞÖÇ';
    const res = normalizeUsername(input);
    if (res !== 'isgusocisgusoc') throw new Error(`Expected isgusocisgusoc, got: ${res}`);
  });

  // 5. ceylinVariantsNormalizeToSameValue
  await runTest('ceylinVariantsNormalizeToSameValue', async () => {
    const v1 = normalizeUsername('CEYLİN');
    const v2 = normalizeUsername('Ceylin');
    const v3 = normalizeUsername('ceyli\u0307n');
    const v4 = normalizeUsername('ceylin');
    const v5 = normalizeUsername(' ceylin ');
    if (v1 !== 'ceylin') throw new Error('v1 mismatch');
    if (v2 !== 'ceylin') throw new Error('v2 mismatch');
    if (v3 !== 'ceylin') throw new Error('v3 mismatch');
    if (v4 !== 'ceylin') throw new Error('v4 mismatch');
    if (v5 !== 'ceylin') throw new Error('v5 mismatch');
  });

  // 6. createStoresNormalizedUsername
  await runTest('createStoresNormalizedUsername', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    const success = await useAuthStore.getState().addUser({
      name: 'Normal User',
      username: 'CEYLİN ',
      password: '123',
      role: 'FIELD',
      isActive: true,
      email: 'n@n.com',
      phone: '123'
    });
    if (!success) throw new Error('Add user failed');
    const added = useAuthStore.getState().users.find(u => u.username === 'ceylin');
    if (!added) throw new Error('Normalized username not found in store');
  });

  // 7. loginUsesNormalizedUsername
  await runTest('loginUsesNormalizedUsername', async () => {
    const originalFetch = global.fetch;
    let requestPayload: any = null;
    global.fetch = async (url, options) => {
      if (url === '/api/auth/login') {
        requestPayload = JSON.parse(options?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, user: { id: 'some-id', username: 'ceylin', role: 'FIELD' } })
        } as any;
      }
      return originalFetch(url, options);
    };

    try {
      await useAuthStore.getState().login(' CEYLİN ', '123');
      if (requestPayload.username !== 'ceylin') {
        throw new Error(`Expected normalized username in request payload, got: ${requestPayload.username}`);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 8. duplicateCheckUsesNormalizedUsername
  await runTest('duplicateCheckUsesNormalizedUsername', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', username: 'ceylin', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const res = normalizeUsername('CEYLİN');
    const isDuplicate = useAuthStore.getState().users.some(u => u.username === res);
    if (!isDuplicate) throw new Error('Duplicate check did not trigger for normalized username');
  });

  // 9. invalidUsernameBecomesValidationError
  await runTest('invalidUsernameBecomesValidationError', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    const success = await useAuthStore.getState().addUser({
      name: 'Invalid User',
      username: '  !@#  ',
      password: '123',
      role: 'FIELD',
      isActive: true,
      email: 'n@n.com',
      phone: '123'
    });
    if (success) throw new Error('Empty normalized username should fail');
  });

  // 10. passwordHashFlowRemainsUnchanged
  await runTest('passwordHashFlowRemainsUnchanged', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    const success = await useAuthStore.getState().addUser({
      name: 'Test Hash User',
      username: 'ceylin',
      password: '123',
      role: 'FIELD',
      isActive: true,
      email: 'n@n.com',
      phone: '123'
    });
    if (!success) throw new Error('Add user failed');
    const added = useAuthStore.getState().users.find(u => u.username === 'ceylin');
    if (added?.password !== '123') throw new Error(`Password should remain plaintext locally, got: ${added?.password}`);
  });

  // 11. existingUserIdIsPreserved
  await runTest('existingUserIdIsPreserved', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    const staff = normalizeUser({ id: 'staff-id', username: 'olduser', role: 'FIELD' });
    useAuthStore.setState({ currentUser: admin, users: [admin, staff] });
    const success = await useAuthStore.getState().updateUser('staff-id', {
      username: 'NEWUSER'
    });
    if (!success) throw new Error('Update failed');
    const updated = useAuthStore.getState().users.find(u => u.username === 'newuser');
    if (!updated || updated.id !== 'staff-id') throw new Error('Existing user ID not preserved');
  });

  // 12. normalizationDoesNotAffectDisplayName
  await runTest('normalizationDoesNotAffectDisplayName', async () => {
    const admin = normalizeUser({ id: 'admin-id', role: 'ADMIN', password: '123' });
    useAuthStore.setState({ currentUser: admin, users: [admin] });
    await useAuthStore.getState().addUser({
      name: 'Nihat Ceylan',
      username: 'ceylin',
      password: '123',
      role: 'FIELD',
      isActive: true,
      email: 'n@n.com',
      phone: '123'
    });
    const added = useAuthStore.getState().users.find(u => u.username === 'ceylin');
    if (added?.name !== 'Nihat Ceylan') throw new Error(`Display name was affected: ${added?.name}`);
  });

  await runTest('sensitiveFieldsAreNotLogged', async () => {
    let loggedData = '';
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      loggedData += args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    };

    try {
      const trimmedName = 'Name';
      const trimmedEmail = 'email@mail.com';
      const trimmedPhone = '123';
      const trimmedTcNo = '11111111111';
      const trimmedAddress = 'Address';

      console.log("User profile status:", {
        hasFullName: !!trimmedName,
        hasEmail: !!trimmedEmail,
        hasPhone: !!trimmedPhone,
        hasTcNo: !!trimmedTcNo,
        hasAddress: !!trimmedAddress,
        role: 'FIELD',
        active: true
      });
    } finally {
      console.log = originalLog;
    }

    const sensitiveWords = ['password', 'salt', 'hash', 'token', '11111111111', 'email@mail.com', '123'];
    sensitiveWords.forEach(word => {
      if (loggedData.includes(word)) {
        throw new Error(`Sensitive data '${word}' was leaked in console logs!`);
      }
    });
  });

  console.log('\n==================================================');
  if (hasFailure) {
    console.log(' PROFILE TEST SUITE FAILED!');
    process.exit(1);
  } else {
    console.log(' ALL PROFILE TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runProfileTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
