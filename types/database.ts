export interface Employee {
  id: string
  name: string
  employee_number: string
  created_at: string
}

export interface ExerciseType {
  id: string
  name: string
  icon: string
}

export interface ExerciseLog {
  id: string
  employee_id: string
  exercise_type_id: string
  log_date: string // 'YYYY-MM-DD'
  memo: string | null
  created_at: string
  employee?: Employee
  exercise_type?: ExerciseType
}
