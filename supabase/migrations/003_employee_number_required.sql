-- 사번을 선택 -> 필수로 변경합니다.
-- 사번이 비어있는 직원이 있으면 임시 사번(ID 앞 8자리)을 채운 뒤 필수 제약을 겁니다.
-- 적용 후 설정 화면 > 직원 관리에서 임시 사번을 실제 사번으로 수정해주세요.

update employees
set employee_number = substr(id::text, 1, 8)
where employee_number is null;

alter table employees alter column employee_number set not null;
