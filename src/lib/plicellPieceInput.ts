export interface PlicellParsedPiece {
  widthCm:
    number;

  heightCm:
    number;
}

export interface PlicellPieceInputResult {
  pieces:
    PlicellParsedPiece[];

  errors:
    string[];
}

const MAX_REPEAT_COUNT =
  100;

function parseLocalizedNumber(
  raw:
    string
): number | null {
  const value =
    raw
      .trim()
      .replace(/\s+/g, "")
      .replace(",", ".");

  if (
    !/^\d+(?:\.\d+)?$/.test(
      value
    )
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function splitInput(
  input:
    string
): string[] {
  return input
    .replace(/\r/g, "\n")
    .split(
      /\n+|;|(?<=\d)\s+(?=\d+\s*(?:\*|x|×))/i
    )
    .map(
      item =>
        item.trim()
    )
    .filter(Boolean);
}

export function parsePlicellPieceInput(
  input:
    string
): PlicellPieceInputResult {
  const pieces:
    PlicellParsedPiece[] = [];

  const errors:
    string[] = [];

  const tokens =
    splitInput(input);

  if (
    tokens.length ===
    0
  ) {
    return {
      pieces,
      errors: [
        "En az bir ölçü girin."
      ]
    };
  }

  tokens.forEach(
    (
      token,
      index
    ) => {
      const compact =
        token
          .replace(/\s+/g, "")
          .replace(/×/g, "x")
          .toLowerCase();

      const match =
        compact.match(
          /^(?:(\d+)\*)?(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/
        );

      if (!match) {
        errors.push(
          `${index + 1}. giriş çözümlenemedi: ${token}`
        );

        return;
      }

      const repeatCount =
        match[1]
          ? Number(match[1])
          : 1;

      const widthCm =
        parseLocalizedNumber(
          match[2]
        );

      const heightCm =
        parseLocalizedNumber(
          match[3]
        );

      if (
        !Number.isInteger(
          repeatCount
        ) ||
        repeatCount <= 0 ||
        repeatCount >
          MAX_REPEAT_COUNT
      ) {
        errors.push(
          `${index + 1}. girişte adet 1-${MAX_REPEAT_COUNT} arasında olmalıdır: ${token}`
        );

        return;
      }

      if (
        widthCm === null ||
        heightCm === null
      ) {
        errors.push(
          `${index + 1}. girişte en ve boy sıfırdan büyük olmalıdır: ${token}`
        );

        return;
      }

      for (
        let count = 0;
        count < repeatCount;
        count++
      ) {
        pieces.push({
          widthCm,
          heightCm
        });
      }
    }
  );

  return {
    pieces,
    errors
  };
}