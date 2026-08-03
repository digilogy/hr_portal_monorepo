output "task_execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}

output "api_task_role_arn" {
  value = aws_iam_role.api_task.arn
}

output "mail_worker_task_role_arn" {
  value = aws_iam_role.mail_worker_task.arn
}

output "jenkins_instance_profile_name" {
  value = aws_iam_instance_profile.jenkins.name
}

output "jenkins_role_arn" {
  value = aws_iam_role.jenkins.arn
}
