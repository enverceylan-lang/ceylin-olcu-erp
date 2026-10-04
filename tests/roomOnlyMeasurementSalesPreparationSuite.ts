import fs from "node:fs";
import path from "node:path";

const pagePath = path.resolve(
  process.cwd(),
  "src/app/cariler/[id]/page.tsx",
);
const source = fs.readFileSync(pagePath, "utf8");

function expectMatch(pattern: RegExp, message: string): void {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

function expectNoMatch(pattern: RegExp, message: string): void {
  if (pattern.test(source)) {
    throw new Error(message);
  }
}

expectMatch(
  /const directRoomMeasurements\s*=\s*measurementStore\.measurements\.filter\(/,
  "Satışa Hazırlık room-only canonical measurement'ları okumuyor",
);
expectMatch(
  /measurement\.roomId === room\.id[\s\S]*!measurementOpeningId\(measurement\)/,
  "Room-only measurement opening olmadan canonical seçilmiyor",
);
expectMatch(
  /const hasAnyMeasurement\s*=[\s\S]*directRoomMeasurements\.length > 0[\s\S]*openingMeasurementGroups\.some/,
  "Satışa Hazırlık room-level + opening-level measurement varlığını birlikte değerlendirmiyor",
);
expectNoMatch(
  /activeOpenings\.length === 0[\s\S]{0,220}ölçü açıklığı bulunmuyor/,
  "Eski opening-mandatory Satışa Hazırlık guard'ı kaldı",
);
expectMatch(
  /for \(const measurement of directRoomMeasurements\)[\s\S]*validateMeasurementRecord\([\s\S]*roomId: room\.id,[\s\S]*roomName: room\.name/,
  "Room-only measurement validation fail-closed değil",
);
expectMatch(
  /for \(const group of openingMeasurementGroups\)[\s\S]*for \(const measurement of group\.measurements\)/,
  "Opening measurement validation korunmadı",
);
expectMatch(
  /setSelectedRoomForPrep\(room\);[\s\S]*setIsPrepModalOpen\(true\);/,
  "Valid room measurement sonrasında mevcut preparation modal açılmıyor",
);
expectMatch(
  /measurements=\{measurementStore\.measurements\}/,
  "RoomPreparationModal canonical measurement store consumer bağlantısı korunmadı",
);

console.log(
  "PAK_ROOM_ONLY_MEASUREMENT_SALES_PREPARATION_GATE",
);