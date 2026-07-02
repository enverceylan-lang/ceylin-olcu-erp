import { Customer } from "@/store/useStore";
import { ExcelProfile, ParsedRow } from "../excelTypes";
import { parseBoolean, parseNumber, parsePhone } from "../excelParsers";

export const customerExcelProfile: ExcelProfile<Customer> = {
  moduleName: "Cariler",
  
  knownColumns: [
    { dbField: "customerCode", aliases: ["Cari Kodu", "Müşteri Kodu"], type: "string" },
    { dbField: "name", aliases: ["Cari Adı", "Müşteri Adı", "Ad Soyad", "Unvan"], type: "string", required: true },
    { dbField: "balance", aliases: ["Bakiye", "Mevcut Bakiye"], type: "number", parser: parseNumber },
    { dbField: "groupCode", aliases: ["Grup Kodu"], type: "string" },
    { dbField: "groupName", aliases: ["Grup Adı"], type: "string" },
    { dbField: "reportCode1", aliases: ["Rapor Kodu 1", "Rapor Kodu"], type: "string" },
    { dbField: "address", aliases: ["Adres", "Açık Adres"], type: "string" },
    { dbField: "locationText", aliases: ["KONUM", "Lokasyon"], type: "string" },
    { dbField: "taxNumber", aliases: ["Vergi No", "Vergi Numarası"], type: "string" },
    { dbField: "taxOffice", aliases: ["Vergi Dairesi"], type: "string" },
    { dbField: "identityNumber", aliases: ["Kimlik No", "TC", "TCKN"], type: "string" },
    { dbField: "cariType", aliases: ["Tipi", "Cari Tipi"], type: "string" },
    { dbField: "dueDay", aliases: ["Vade Günü"], type: "number", parser: parseNumber },
    { dbField: "phone", aliases: ["Telefon", "Tel"], type: "phone", parser: parsePhone },
    { dbField: "mobile1", aliases: ["Cep Tel 1", "Cep Telefonu 1", "Cep"], type: "phone", parser: parsePhone },
    { dbField: "mobile2", aliases: ["Cep Tel 2", "Cep Telefonu 2"], type: "phone", parser: parsePhone },
    { dbField: "email", aliases: ["EMail", "E-Posta"], type: "string" },
    { dbField: "salespersonName", aliases: ["Plasiyer Adı", "Plasiyer"], type: "string" },
    { dbField: "isActive", aliases: ["Aktif", "Aktif Mi", "Durum"], type: "boolean", parser: parseBoolean },
    { dbField: "eInvoice", aliases: ["E-Fatura", "E Fatura Mükellefi"], type: "boolean", parser: parseBoolean },
    { dbField: "authorizedPerson", aliases: ["Cari Yetkili Adı", "Yetkili"], type: "string" },
    { dbField: "hasRisk", aliases: ["Risk Var Mı"], type: "boolean", parser: parseBoolean },
    { dbField: "riskLimit", aliases: ["Risk", "Risk Limiti"], type: "number", parser: parseNumber },
    { dbField: "isLockedForAllTransactions", aliases: ["Tüm İşlemlerde Kilit", "Kilitli"], type: "boolean", parser: parseBoolean },
  ],

  findMatch: (row, existingData) => {
    // 1. Eşleştirme önceliği: customerCode
    if (row.customerCode) {
      const match = existingData.find(c => c.customerCode === row.customerCode);
      if (match) {
        return { matchId: match.id, status: 'UPDATE', message: 'Cari kodu eşleşti.' };
      }
    }
    
    // 2. Eşleştirme önceliği: Telefon veya Cep
    const phones = [row.phone, row.mobile1, row.mobile2].filter(Boolean);
    if (phones.length > 0) {
      const match = existingData.find(c => {
        const cPhones = [c.phone, c.mobile1, c.mobile2].filter(Boolean).map(p => parsePhone(p));
        return phones.some(p => cPhones.includes(parsePhone(p)));
      });
      if (match) {
        return { matchId: match.id, status: 'UPDATE', message: 'Telefon numarası eşleşti.' };
      }
    }
    
    // 3. Sadece isim eşleşirse otomatik birleştirme yapma, uyarı ver ve YENİ kabul et
    if (row.name) {
      const match = existingData.find(c => c.name.trim().toLowerCase() === row.name?.trim().toLowerCase());
      if (match) {
        return { status: 'MANUAL_REVIEW', message: 'Aynı isimli cari bulundu ancak telefon/kod eşleşmedi. Yeni kayıt olarak eklenecek.' };
      }
    }
    
    return { status: 'NEW' };
  }
};
