// Fyller i Jordbruksverkets officiella "Förflyttningsdokument – får och getter"
// (blankett SJV JSB3.12, 2024-05-13, se public/forflyttningsdokument-far-getter-jsb3.12.pdf)
// med pdf-lib. Blanketten har bara 6 rader för djuridentitet — vid fler djur
// fylls flera kopior av mallen i, flattas (så ifyllda fält inte krockar
// namnmässigt vid sammanslagning) och slås ihop till ett dokument med en
// sida per påbörjad grupp om 6 djur.

const ANIMALS_PER_PAGE = 6
const TEMPLATE_PATH = 'forflyttningsdokument-far-getter-jsb3.12.pdf'

export interface MovementDocumentInput {
  ownSeNumber: string
  destinationSeNumber: string
  date: string
  animalIdentities: string[]
  vehicleReg: string
  transporterPermit: string
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function fillMovementDocument(input: MovementDocumentInput): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const templateUrl = `${import.meta.env.BASE_URL}${TEMPLATE_PATH}`
  const templateBytes = await (await fetch(templateUrl)).arrayBuffer()

  const batches = chunk(input.animalIdentities, ANIMALS_PER_PAGE)
  const outDoc = await PDFDocument.create()

  for (const batch of batches) {
    const doc = await PDFDocument.load(templateBytes)
    const form = doc.getForm()
    form.getCheckBox('Får').check()
    form.getTextField('Anläggningens registreringsnummer').setText(input.ownSeNumber)
    form.getTextField('Destinationsanläggningens registreringsnummer').setText(input.destinationSeNumber)
    form.getTextField('Det totala antalet djur').setText(String(input.animalIdentities.length))
    form.getTextField('Avsändningsdatum').setText(input.date)
    batch.forEach((identity, i) => {
      form
        .getTextField(
          `Djurets individuella identitetskod eller djurets födelseanläggnings unika registreringsnummer som det visas på identitetsmärket.${i}`,
        )
        .setText(identity)
    })
    if (input.vehicleReg) {
      form.getTextField('Numret på transportmedlets registreringsskylt').setText(input.vehicleReg)
    }
    if (input.transporterPermit) {
      form.getTextField('Transportörens tillståndsnummer (om transportören har tillstånd)').setText(input.transporterPermit)
    }
    // Flattas innan sammanslagning — annars kolliderar de identiskt namngivna
    // fälten mellan kopiorna (samma fältnamn på flera sidor delar annars värde).
    form.flatten()

    const [copiedPage] = await outDoc.copyPages(doc, [0])
    outDoc.addPage(copiedPage)
  }

  const bytes = await outDoc.save()
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
}
