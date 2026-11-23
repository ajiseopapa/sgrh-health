// 엑셀 일괄 등록 API 시험 — 시험 DB 전용(관리자 비밀번호는 .env.local 에서 읽음). 끝나면 시험 직원(9000xx·000012)과 시험부서A·B 를 지워야 다시 돌릴 수 있습니다.
import fs from 'node:fs'
const H='http://localhost:3576'
const env=fs.readFileSync('.env.local','utf8')
if(!env.includes('tqmacchjfkziftziwhrn')){console.error('시험 DB 아님');process.exit(1)}
const pw=env.match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim().replace(/^["']|["']$/g,'')
function client(){let ck='';return async(p,o={})=>{const r=await fetch(H+p,{method:o.method||'GET',headers:{'x-sgrh-request':'1','Content-Type':'application/json',Origin:H,cookie:ck},body:o.body?JSON.stringify(o.body):undefined});for(const c of r.headers.getSetCookie?.()||[]){const kv=c.split(';')[0];if(!kv.endsWith('='))ck=(ck?ck+'; ':'')+kv}return{status:r.status,...(await r.json().catch(()=>({})))}}}
let pass=0,fail=0;const check=(n,c,x='')=>{c?(pass++,console.log('  ✅',n)):(fail++,console.log('  ❌',n,x))}
const anon=client(), ad=client()
const rows=[{employeeNumber:'900001',department:'시험부서A',position:'팀장',name:'엑셀일번'},{employeeNumber:'12',department:'시험부서A',position:'사원',name:'엑셀이번'},{employeeNumber:'900003',department:'시험부서B',position:'대리',name:'엑셀삼번'},{employeeNumber:'S001',department:'시험부서B',position:'과장',name:'이미있음'},{employeeNumber:'900005',department:'',position:'주임',name:'부서없음'},{employeeNumber:'900006',department:'시험부서A',position:'사원',name:''},{employeeNumber:'900001',department:'시험부서A',position:'팀장',name:'겹침'}]
check('관리자 아님 → 거절',[401,403].includes((await anon('/api/admin/employees/bulk',{method:'POST',body:{rows}})).status))
check('관리자 로그인',(await ad('/api/verify-admin',{method:'POST',body:{password:pw}})).status===200)
check('빈 목록 400',(await ad('/api/admin/employees/bulk',{method:'POST',body:{rows:[]}})).status===400)
const r=await ad('/api/admin/employees/bulk',{method:'POST',body:{rows}})
check('등록 200 · 4명 추가',r.status===200&&r.added===4,JSON.stringify(r).slice(0,300))
check('이미 있는 사번 1명 건너뜀',r.skipped?.length===1&&r.skipped[0].employeeNumber==='S001')
check('잘못된 줄 2개(이름 없음·파일 안 중복)',r.invalid?.length===2&&r.invalid.map(v=>v.line).join()==='6,7',JSON.stringify(r.invalid))
check('새 부서 2개',r.newDepartments?.length===2)
const list=(await ad('/api/admin/employees')).employees
const f=n=>list.find(e=>e.employee_number===n)
check('숫자 사번 12 → 000012',!!f('000012')&&f('000012').name==='엑셀이번')
check('부서 배정됨',f('900001')?.department?.name==='시험부서A'&&f('900003')?.department?.name==='시험부서B')
check('부서 없는 직원은 부서 없이',f('900005')&&f('900005').department===null)
check('PIN 없음(직접 정함)',f('900001')?.pin_status==='none')
check('S001 이름 안 바뀜',f('S001')?.name==='김도윤')
const again=await ad('/api/admin/employees/bulk',{method:'POST',body:{rows}})
check('다시 올리면 0명 추가 · 5명 건너뜀',again.added===0&&again.skipped.length===5&&again.newDepartments.length===0,JSON.stringify(again).slice(0,200))
check('새 직원이 직접 PIN 정할 수 있음',(await anon('/api/auth/setup-pin?id='+f('900001').id)).hasPin===false)
console.log(`\n결과: ${pass} 통과 / ${fail} 실패`)
