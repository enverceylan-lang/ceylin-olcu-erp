import assert from "node:assert/strict";
import test from "node:test";

import {
  isInstallationAssignableUser,
  resolveInstallationAssignment
} from "../src/lib/installationAssignmentService";

test(
  "UNASSIGNED does not silently choose an installer",
  () => {
    assert.deepEqual(
      resolveInstallationAssignment(undefined),
      {
        mode: "UNASSIGNED",
        party: undefined
      }
    );
  }
);

test(
  "INTERNAL admin uses user identity without provider current account",
  () => {
    const result =
      resolveInstallationAssignment({
        id: "user-admin",
        name: "Enver",
        role: "ADMIN",
        isActive: true
      });

    assert.equal(result.mode, "INTERNAL");

    if (result.mode !== "INTERNAL") {
      throw new Error("Expected INTERNAL");
    }

    assert.equal(
      result.party.userId,
      "user-admin"
    );

    assert.equal(
      result.party.id,
      "internal-user:user-admin"
    );

    assert.equal(
      result.party.providerCustomerId,
      undefined
    );
  }
);

test(
  "INTERNAL company installer needs no provider cari",
  () => {
    const result =
      resolveInstallationAssignment({
        id: "user-company-installer",
        name: "Firma Montaj Personeli",
        role: "INSTALLER",
        isActive: true
      });

    assert.equal(result.mode, "INTERNAL");
  }
);

test(
  "EXTERNAL installer keeps provider cari for earnings and user id for access",
  () => {
    const result =
      resolveInstallationAssignment({
        id: "user-external-installer",
        name: "Ali Montaj",
        role: "INSTALLER",
        isActive: true,
        providerType: "INSTALLER",
        providerCustomerId:
          "cari-ali-montaj"
      });

    assert.equal(result.mode, "EXTERNAL");

    if (result.mode !== "EXTERNAL") {
      throw new Error("Expected EXTERNAL");
    }

    assert.equal(
      result.party.id,
      "cari-ali-montaj"
    );

    assert.equal(
      result.party.userId,
      "user-external-installer"
    );

    assert.equal(
      result.party.providerCustomerId,
      "cari-ali-montaj"
    );
  }
);

test(
  "external installer marker without provider cari fails closed",
  () => {
    assert.deepEqual(
      resolveInstallationAssignment({
        id: "user-bad-external",
        name: "Eksik Dış Montajcı",
        role: "INSTALLER",
        isActive: true,
        providerType: "INSTALLER"
      }),
      {
        mode: "REJECTED",
        reason:
          "EXTERNAL_PROVIDER_ID_MISSING"
      }
    );
  }
);

test(
  "only admin/company admin/installer roles are selectable for installation",
  () => {
    assert.equal(
      isInstallationAssignableUser({
        id: "admin",
        name: "Admin",
        role: "ADMIN",
        isActive: true
      }),
      true
    );

    assert.equal(
      isInstallationAssignableUser({
        id: "installer",
        name: "Installer",
        role: "INSTALLER",
        isActive: true
      }),
      true
    );

    assert.equal(
      isInstallationAssignableUser({
        id: "office",
        name: "Office",
        role: "OFFICE",
        isActive: true
      }),
      false
    );
  }
);