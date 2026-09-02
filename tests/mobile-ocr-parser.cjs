const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-ocr.js'),'utf8');
assert.match(source,/tessedit_pageseg_mode:api\.PSM\?\.AUTO\|\|'3'/);
assert.doesNotMatch(source,/tessedit_pageseg_mode:api\.PSM\?\.SINGLE_BLOCK/);
const context={window:{},document:{}};
vm.createContext(context);
vm.runInContext(source,context);

const noisyScreen=`
myCRM Búsqueda
Criterio
Msisdn/Fijo
Documento
43161930S
Msisdn/Fijo
858718773
MultiMarca
BÚSQUEDA
MARIA VANESA CORTES
YGC25041122282164
Datos compartidos
6
LA SINFÍN GB ILIMITADOS CONV
642284966
`;

const result=context.window.TPFMobileOCR.extract(noisyScreen);
assert.equal(result.dni,'43161930S');
assert.equal(result.phone,'858718773');
assert.equal(result.fullName,'MARIA VANESA CORTES');
assert.equal(result.first,'MARIA');
assert.equal(result.last,'VANESA CORTES');
assert.ok(!JSON.stringify({dni:result.dni,phone:result.phone,fullName:result.fullName}).includes('YGC25041122282164'));
assert.notEqual(result.phone,'642284966');

const reordered=context.window.TPFMobileOCR.extract(`
642284966
DNI / NIF: 43161930S
Msisdn/Fijo: 858 718 773
BÚSQUEDA
MARIA VANESA CORTES
Datos compartidos
`);
assert.equal(reordered.dni,'43161930S');
assert.equal(reordered.phone,'858718773');
assert.equal(reordered.fullName,'MARIA VANESA CORTES');

const noiseOnly=context.window.TPFMobileOCR.extract(`
YGC25041122282164
Datos compartidos
LA SINFÍN GB ILIMITADOS CONV
642284966
`);
assert.equal(noiseOnly.dni,'');
assert.equal(noiseOnly.phone,'');
assert.equal(noiseOnly.fullName,'');

const markedName=context.window.TPFMobileOCR.extract(`
Documento
43161930S
Msisdn/Fijo
858718773
BÚSQUEDA
=. MARIA VANESA CORTES “A
Datos compartidos
`);
assert.equal(markedName.fullName,'MARIA VANESA CORTES');

const cameraOcr=context.window.TPFMobileOCR.extract(`
myCRM Busqueda
Criterio
Msisdn/Fijo
Documento
43161930S
Msisdn/Fijo sy
858718773
MultiMarca
=. MARIA VANESA CORTES “A
YGC25041122282164
Datos compartidos
LA SINFIN GB ILIMITADOS CONV
642284966
`);
assert.equal(cameraOcr.dni,'43161930S');
assert.equal(cameraOcr.phone,'858718773');
assert.equal(cameraOcr.fullName,'MARIA VANESA CORTES');

const embeddedNoise=context.window.TPFMobileOCR.extract(`
Documento
YGC25041122282164
Msisdn/Fijo
123456789012345678
BÚSQUEDA
DATOS COMPARTIDOS
`);
assert.equal(embeddedNoise.dni,'');
assert.equal(embeddedNoise.phone,'');

const embeddedDni=context.window.TPFMobileOCR.extract(`
Documento
12345678943161930S
`);
assert.equal(embeddedDni.dni,'');

const labelInsideName=context.window.TPFMobileOCR.extract(`
JENNIFER LOPEZ
C25041122
`);
assert.equal(labelInsideName.dni,'');

const dniSAsFive=context.window.TPFMobileOCR.extract(`
Documento
431619305
`);
assert.equal(dniSAsFive.dni,'43161930S');

const dniSAsEight=context.window.TPFMobileOCR.extract(`
Documento
431619308
`);
assert.equal(dniSAsEight.dni,'43161930S');

const dniSAsEightInline=context.window.TPFMobileOCR.extract('Documento: 431619308');
assert.equal(dniSAsEightInline.dni,'43161930S');

const duplicatedFinalGlyph=context.window.TPFMobileOCR.extract(`
Documento
4316193058
Msisdn/Fijo
858718773
`);
assert.equal(duplicatedFinalGlyph.dni,'43161930S');

for(const duplicated of ['431619308S']){
  assert.equal(context.window.TPFMobileOCR.extract(`Documento\n${duplicated}\nMsisdn/Fijo\n858718773`).dni,'43161930S');
}

const documentaOcr=context.window.TPFMobileOCR.extract(`
Documenta
4316193058
Msisdn/Fijo
858718773
`);
assert.equal(documentaOcr.dni,'43161930S');

const documenteOcr=context.window.TPFMobileOCR.extract(`
Documente
431619308
Msisdn/Fijo
858718773
BÚSQUEDA
MARIA VANESA CORTES
Datos compartidos
`);
assert.equal(documenteOcr.dni,'43161930S');
assert.equal(documenteOcr.phone,'858718773');
assert.equal(documenteOcr.fullName,'MARIA VANESA CORTES');

const docurnentoOcr=context.window.TPFMobileOCR.extract(`
Docurnento
431619308
`);
assert.equal(docurnentoOcr.dni,'43161930S');

const structuralDni=context.window.TPFMobileOCR.extract(`
Criterio
Msisdn/Fijo
Docuniento
431619308
Msisdn/Fijo
858718773
BÚSQUEDA
MARIA VANESA CORTES
Datos compartidos
`);
assert.equal(structuralDni.dni,'43161930S');
assert.equal(structuralDni.phone,'858718773');

const distortedFirstPhoneAndDocument=context.window.TPFMobileOCR.extract(`
Criterio
Msisdr/Fij0
Docurnenlo
4316193058
Msisdn/Fijo
858718773
BÚSQUEDA
MARIA VANESA CORTES
Datos compartidos
`);
assert.equal(distortedFirstPhoneAndDocument.dni,'43161930S');
assert.equal(distortedFirstPhoneAndDocument.phone,'858718773');
assert.equal(distortedFirstPhoneAndDocument.fullName,'MARIA VANESA CORTES');

const bodyZeroAsLetter=context.window.TPFMobileOCR.extract(`
Documento
4316193O8
`);
assert.equal(bodyZeroAsLetter.dni,'43161930S');

const finalEightAsLetter=context.window.TPFMobileOCR.extract(`
Documento
43161930B
`);
assert.equal(finalEightAsLetter.dni,'43161930S');

const mergedBeforePhoneLabel=context.window.TPFMobileOCR.extract(`
Msisdn/Fijo
Docuniento
43I6I93O8 Msisdn/Fijo
858718773
`);
assert.equal(mergedBeforePhoneLabel.dni,'43161930S');
assert.equal(mergedBeforePhoneLabel.phone,'858718773');

const bodyLetters=context.window.TPFMobileOCR.extract(`
Documento
43I6I93OS
Msisdn/Fijo
858718773
`);
assert.equal(bodyLetters.dni,'43161930S');

const structuralPhonesOnly=context.window.TPFMobileOCR.extract(`
858718773
Msisdn/Fijo
642284966
`);
assert.equal(structuralPhonesOnly.dni,'');

const longNumericDocumentNoise=context.window.TPFMobileOCR.extract(`
Documento
1234567890
Msisdn/Fijo
858718773
`);
assert.equal(longNumericDocumentNoise.dni,'');

const extendedPhoneNoise=context.window.TPFMobileOCR.extract(`
Documento
6422849660
Msisdn/Fijo
858718773
`);
assert.equal(extendedPhoneNoise.dni,'');

for(const repeatedSuffix of ['1234567822','1000000155']){
  assert.equal(context.window.TPFMobileOCR.extract(`Documento\n${repeatedSuffix}\nMsisdn/Fijo\n858718773`).dni,'');
}

for(const unrelatedDocWord of ['DOCENCIA','DOCTORA']){
  assert.equal(context.window.TPFMobileOCR.extract(`${unrelatedDocWord}\n123456782\nMsisdn/Fijo\n858718773`).dni,'');
}

const structuralLongId=context.window.TPFMobileOCR.extract(`
YGC25041122282164
Msisdn/Fijo
858718773
`);
assert.equal(structuralLongId.dni,'');

const structuralNie=context.window.TPFMobileOCR.extract(`
Msisdn/Fijo
Docuniento
X1234567L
Msisdn/Fijo
858718773
`);
assert.equal(structuralNie.dni,'X1234567L');

const structuralNif=context.window.TPFMobileOCR.extract(`
Msisdn/Fijo
Docuniento
B12345678
Msisdn/Fijo
858718773
`);
assert.equal(structuralNif.dni,'B12345678');

const separatedDni=context.window.TPFMobileOCR.extract(`
Documento
43.161.930-S
`);
assert.equal(separatedDni.dni,'43161930S');

const phoneWithDniChecksum=context.window.TPFMobileOCR.extract(`
Documento
600000005
`);
assert.equal(phoneWithDniChecksum.dni,'');

const phoneWithDniChecksumEight=context.window.TPFMobileOCR.extract(`
Documento
600000008
`);
assert.equal(phoneWithDniChecksumEight.dni,'');

const phoneWithFinalDigitAsLetter=context.window.TPFMobileOCR.extract(`
Documento
60000000B
`);
assert.equal(phoneWithFinalDigitAsLetter.dni,'');

const truncatedPhoneAsDocument=context.window.TPFMobileOCR.extract(`
Documento
60000000
`);
assert.equal(truncatedPhoneAsDocument.dni,'');

const singlePhoneLabelNumber=context.window.TPFMobileOCR.extract(`
100000015
Msisdn/Fijo
858718773
`);
assert.equal(singlePhoneLabelNumber.dni,'');

const eightDigitsBeforeFirstPhone=context.window.TPFMobileOCR.extract(`
12345678
Criterio
Msisdn/Fijo
858718773
`);
assert.equal(eightDigitsBeforeFirstPhone.dni,'');

const unrelatedBetweenPhoneLabels=context.window.TPFMobileOCR.extract(`
Msisdn/Fijo
123456782
Msisdn/Fijo
858718773
`);
assert.equal(unrelatedBetweenPhoneLabels.dni,'');

const spacedDocumentValue=context.window.TPFMobileOCR.extract(`
Documente



431619308
`);
assert.equal(spacedDocumentValue.dni,'43161930S');

const dniLetterMissing=context.window.TPFMobileOCR.extract(`
Documento
43161930
`);
assert.equal(dniLetterMissing.dni,'43161930S');

const wrongDniLetter=context.window.TPFMobileOCR.extract(`
Documento
43161930A
`);
assert.equal(wrongDniLetter.dni,'');

const unrelatedNineDigits=context.window.TPFMobileOCR.extract(`
Documento
123456789
`);
assert.equal(unrelatedNineDigits.dni,'');

const unrelatedEightEnding=context.window.TPFMobileOCR.extract(`
Documento
123456788
`);
assert.equal(unrelatedEightEnding.dni,'');

const phoneAsDocument=context.window.TPFMobileOCR.extract(`
Documento
642284966
`);
assert.equal(phoneAsDocument.dni,'');

const exactNie=context.window.TPFMobileOCR.extract(`
Documento
X1234567L
`);
assert.equal(exactNie.dni,'X1234567L');

const noDocumentLabel=context.window.TPFMobileOCR.extract('43161930');
assert.equal(noDocumentLabel.dni,'');

console.log('mobile OCR parser: ok');
