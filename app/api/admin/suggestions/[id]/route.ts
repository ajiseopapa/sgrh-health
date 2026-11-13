import { fail, handle } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

// 건의하기 기능 폐지(PM 결정, 028). 건의 확인·답변·삭제 요청을 더 받지 않습니다.
// 기존 건의 자료는 DB 에 그대로 있고, 필요하면 SQL Editor·백업으로 열람합니다.
// 다시 열려면 이 파일을 git 이력(902c7c6 이전)에서 되돌리고 028 의 되돌리기 SQL 을 실행합니다.
const closed = handle(async () => fail(410, '건의하기 기능은 종료되었어요.'))
export const PATCH = closed
export const DELETE = closed
