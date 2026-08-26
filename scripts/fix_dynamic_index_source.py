from pathlib import Path

p=Path('api/index.js')
s=p.read_text(encoding='utf-8')
old_header="""const https = require('https');\n\nconst RAW_INDEX = 'https://raw.githubusercontent.com/jramon07-lab/the_phone_face/work/crm-unica-20260825/index.html';\n"""
new_header="""const https = require('https');\nconst fs = require('fs');\nconst path = require('path');\n\nconst RAW_BASE = 'https://raw.githubusercontent.com/jramon07-lab/the_phone_face';\nconst FALLBACK_RAW_INDEX = RAW_BASE + '/work/crm-unica-20260825/index.html';\n\nfunction rawIndexUrl(){\n  const sha=String(process.env.VERCEL_GIT_COMMIT_SHA||'').trim();\n  return sha ? `${RAW_BASE}/${sha}/index.html` : FALLBACK_RAW_INDEX;\n}\n"""
if old_header not in s:
    raise SystemExit('No se encontró cabecera RAW_INDEX antigua')
s=s.replace(old_header,new_header,1)
old_build="""async function buildHtml(){\n  const html=await getText(RAW_INDEX+'?v='+Date.now());\n  return html.includes('</body>')?html.replace('</body>',PATCH+'\\n</body>'):html+PATCH;\n}\n"""
new_build="""async function buildHtml(){\n  let html='';\n  try{\n    html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');\n  }catch(_){\n    html=await getText(rawIndexUrl()+'?v='+Date.now());\n  }\n  return html.includes('</body>')?html.replace('</body>',PATCH+'\\n</body>'):html+PATCH;\n}\n"""
if old_build not in s:
    raise SystemExit('No se encontró buildHtml antiguo')
s=s.replace(old_build,new_build,1)
s=s.replace('handler.RAW_INDEX=RAW_INDEX;','handler.RAW_INDEX=rawIndexUrl();',1)
p.write_text(s,encoding='utf-8')
print('api/index.js ahora sirve el índice del commit desplegado')
