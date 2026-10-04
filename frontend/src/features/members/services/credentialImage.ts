import JsBarcode from 'jsbarcode'
import type { Member } from '../../../types/api'

// ID-1 proportions (85.6 × 54 mm), approximately 300 dpi.
export const CREDENTIAL_WIDTH = 1011
export const CREDENTIAL_HEIGHT = 638

export async function createCredentialImage(member: Member): Promise<Blob> {
  const template = new Image()
  template.src = '/images/member-credential-template.png'
  await template.decode()
  await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width = CREDENTIAL_WIDTH
  canvas.height = CREDENTIAL_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no permite generar la imagen de la credencial.')
  // Crop the template's outer white margin; retain transparent rounded corners.
  context.beginPath()
  context.roundRect(0, 0, canvas.width, canvas.height, 32)
  context.clip()
  context.drawImage(template, 28, 36, 1096, 657, 0, 0, canvas.width, canvas.height)

  const drawText = (text: string, top: number, initialSize: number) => {
    let size = initialSize
    const maxWidth = canvas.width * 0.394
    context.font = `800 ${size}px Impact, "Arial Narrow", sans-serif`
    while (context.measureText(text).width > maxWidth && size > 10) {
      size -= 1
      context.font = `800 ${size}px Impact, "Arial Narrow", sans-serif`
    }
    context.fillStyle = '#111111'
    context.textBaseline = 'top'
    context.fillText(text, canvas.width * 0.582, canvas.height * top, maxWidth)
  }
  drawText(`${member.first_name} ${member.last_name}`, 0.267, 32)
  drawText(member.barcode_value, 0.398, 25)

  const barcode = document.createElement('canvas')
  JsBarcode(barcode, member.barcode_value, {
    format: 'CODE128', displayValue: false, height: 100, width: 2,
    margin: 12, background: '#ffffff', lineColor: '#000000',
  })
  const x = canvas.width * 0.463
  const y = canvas.height * 0.495
  const width = canvas.width * 0.494
  const height = canvas.height * 0.199
  context.fillStyle = '#ffffff'
  context.fillRect(x, y, width, height)
  context.imageSmoothingEnabled = false
  context.drawImage(barcode, x + width * 0.03, y + height * 0.05, width * 0.94, height * 0.9)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo generar la imagen de la credencial.'))
    }, 'image/png')
  })
}
