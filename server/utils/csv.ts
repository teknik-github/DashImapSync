export function parseCsv(content: string) {
  const rows: string[][] = []
  let currentCell = ''
  let currentRow: string[] = []
  let insideQuotes = false
  const normalizedContent = content.replace(/^\uFEFF/, '')

  for (let index = 0; index < normalizedContent.length; index += 1) {
    const character = normalizedContent[index]

    if (insideQuotes) {
      if (character === '"') {
        if (normalizedContent[index + 1] === '"') {
          currentCell += '"'
          index += 1
        }
        else {
          insideQuotes = false
        }
      }
      else {
        currentCell += character
      }

      continue
    }

    if (character === '"') {
      insideQuotes = true
      continue
    }

    if (character === ',') {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (character === '\n') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentCell = ''
      currentRow = []
      continue
    }

    if (character !== '\r') {
      currentCell += character
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  const nonEmptyRows = rows.filter((row) => row.some((cell) => cell.trim() !== ''))
  const [headerRow, ...dataRows] = nonEmptyRows

  if (!headerRow) {
    return {
      headers: [],
      rows: [],
    }
  }

  const headers = headerRow.map((header) => header.trim())
  const mappedRows = dataRows.map((row) => {
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = row[index] ?? ''
      return record
    }, {})
  })

  return {
    headers,
    rows: mappedRows,
  }
}
