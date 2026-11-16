resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  tags = { Name = var.state_bucket_name }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.state.arn,
          "${aws_s3_bucket.state.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
    ]
  })
}

resource "aws_dynamodb_table" "locks" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = { Name = var.lock_table_name }
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  tags = { Name = "agentops-github-oidc" }
}

data "aws_iam_policy_document" "terraform_plan_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:pull_request"]
    }
  }
}

resource "aws_iam_role" "terraform_plan" {
  name                 = "agentops-terraform-plan"
  assume_role_policy   = data.aws_iam_policy_document.terraform_plan_assume.json
  max_session_duration = 3600

  tags = { Name = "agentops-terraform-plan" }
}

resource "aws_iam_role_policy_attachment" "terraform_plan_readonly" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

data "aws_iam_policy_document" "terraform_plan_state" {
  statement {
    sid       = "TerraformStateList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    sid       = "TerraformStateObjects"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.state.arn}/*"]
  }
}

resource "aws_iam_role_policy" "terraform_plan_state" {
  name   = "agentops-terraform-plan-state"
  role   = aws_iam_role.terraform_plan.id
  policy = data.aws_iam_policy_document.terraform_plan_state.json
}

data "aws_iam_policy_document" "terraform_apply_assume" {
  for_each = toset(["dev", "prod"])

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:terraform-${each.key}"]
    }
  }
}

resource "aws_iam_role" "terraform_apply" {
  for_each = toset(["dev", "prod"])

  name                 = "agentops-terraform-apply-${each.key}"
  assume_role_policy   = data.aws_iam_policy_document.terraform_apply_assume[each.key].json
  max_session_duration = 3600

  tags = { Name = "agentops-terraform-apply-${each.key}" }
}

# Terraform creates IAM/VPC/EKS; narrow later with a permissions boundary.
resource "aws_iam_role_policy_attachment" "terraform_apply_admin" {
  for_each = aws_iam_role.terraform_apply

  role       = each.value.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
