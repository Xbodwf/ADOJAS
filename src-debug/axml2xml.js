const fs = await import('fs');
const Axml2Xml = await import('axml2xml');
const buf = fs.readFileSync('./AndroidXmls/AndroidManifest.xml');
console.log(Axml2Xml.Axml2xml)
fs.writeFileSync('./AndroidXmls/_AndroidManifest.xml',Axml2Xml.Axml2xml.convert(buf),'utf-8');