/** Validate a server snapshot before using its EXISTING canonical parent for one push. */
export type Scope = Readonly<{tenantId:string;companyId:string;branchId:string;accountingPeriodId:string}>;
export type ParentIds = Readonly<{customerId:string;roomId:string;openingId?:string}>;
export type CanonicalParentPackage = {
  room:{id:string;name:string;customerAddressId:string|null;createdAt:string|null;updatedAt:string|null};
  opening?:{id:string;name:string;width:number|null;height:number|null;fieldNotes:string;createdAt:string|null;updatedAt:string|null};
};
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const identifier=(v:unknown):v is string=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=200;
const nullableText=(v:unknown):v is string|null=>v===null||(typeof v==='string'&&v.length<10000);
const scopeKeys=['tenantId','companyId','branchId','accountingPeriodId'] as const;
export function getCanonicalParentPackageFromSnapshot(raw:unknown,scope:Scope,ids:ParentIds):CanonicalParentPackage|null {
  if(!object(raw)||raw.verified!==true||!object(raw.scope)||!object(raw.parentPackage))return null;
  if(!scopeKeys.every(k=>identifier(scope[k])&&(raw.scope as Record<string,unknown>)[k]===scope[k]))return null;
  if(!identifier(ids.customerId)||!identifier(ids.roomId))return null;
  const openingId=ids.openingId||null;
  if(openingId!==null&&!identifier(openingId))return null;
  if(raw.customerId!==ids.customerId||raw.roomId!==ids.roomId||raw.openingId!==openingId)return null;
  const rawPackage=raw.parentPackage;
  if(!object(rawPackage.room))return null;
  const room=rawPackage.room;
  if(room.id!==ids.roomId||!identifier(room.name)||!nullableText(room.customerAddressId)||!nullableText(room.createdAt)||!nullableText(room.updatedAt))return null;
  const parent:CanonicalParentPackage={room:{id:ids.roomId,name:room.name,customerAddressId:room.customerAddressId,createdAt:room.createdAt,updatedAt:room.updatedAt}};
  if(openingId!==null){
    if(!object(rawPackage.opening))return null;
    const opening=rawPackage.opening;
    if(opening.id!==openingId||!identifier(opening.name))return null;
    if(!nullableText(opening.createdAt)||!nullableText(opening.updatedAt)||typeof opening.fieldNotes!=='string'||opening.fieldNotes.length>10000)return null;
    if(![opening.width,opening.height].every(v=>v===null||(typeof v==='number'&&Number.isFinite(v))))return null;
    parent.opening={id:openingId,name:opening.name,width:opening.width as number|null,height:opening.height as number|null,fieldNotes:opening.fieldNotes,createdAt:opening.createdAt,updatedAt:opening.updatedAt};
  }else if(rawPackage.opening!==undefined&&rawPackage.opening!==null)return null;
  return parent;
}
