const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-ocr.js'),'utf8');
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
