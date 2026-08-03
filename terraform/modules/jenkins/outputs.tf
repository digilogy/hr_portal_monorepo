output "instance_id" {
  value = aws_instance.jenkins.id
}

output "public_ip" {
  value = aws_eip.jenkins.public_ip
}

output "private_ip" {
  value = aws_instance.jenkins.private_ip
}
