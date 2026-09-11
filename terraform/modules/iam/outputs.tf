output "task_execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}

output "api_task_role_arn" {
  value = aws_iam_role.api_task.arn
}

output "mail_worker_task_role_arn" {
  value = aws_iam_role.mail_worker_task.arn
}

output "github_actions_user_name" {
  value = aws_iam_user.github_actions.name
}

output "github_actions_access_key_id" {
  value = aws_iam_access_key.github_actions.id
}

output "github_actions_secret_access_key" {
  value     = aws_iam_access_key.github_actions.secret
  sensitive = true
}

output "github_actions_policy_arn" {
  value = aws_iam_policy.github_actions.arn
}
