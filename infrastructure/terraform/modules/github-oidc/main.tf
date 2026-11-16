locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.this[0].arn : var.oidc_provider_arn

  branch_subjects      = [for branch in var.allowed_branches : "repo:${var.github_repository}:ref:refs/heads/${branch}"]
  environment_subjects = [for environment in var.allowed_environments : "repo:${var.github_repository}:environment:${environment}"]
  pull_request_subjects = var.allow_pull_requests ? [
    "repo:${var.github_repository}:pull_request"
  ] : []

  allowed_subjects = concat(
    local.branch_subjects,
    local.environment_subjects,
    local.pull_request_subjects,
  )
}

resource "aws_iam_openid_connect_provider" "this" {
  count = var.create_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  tags = var.tags
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.allowed_subjects
    }
  }
}

resource "aws_iam_role" "this" {
  name                 = "${var.name}-github-ci"
  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  max_session_duration = 3600

  tags = var.tags
}

data "aws_iam_policy_document" "ci" {
  statement {
    sid       = "EcrAuthorization"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPushPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:DescribeImages",
    ]
    resources = var.ecr_repository_arns
  }

  dynamic "statement" {
    for_each = var.eks_cluster_arn != "" ? [var.eks_cluster_arn] : []

    content {
      sid       = "EksDescribe"
      actions   = ["eks:DescribeCluster"]
      resources = [statement.value]
    }
  }

  dynamic "statement" {
    for_each = var.terraform_state_bucket_arn != "" ? [var.terraform_state_bucket_arn] : []

    content {
      sid       = "TerraformStateList"
      actions   = ["s3:ListBucket"]
      resources = [statement.value]
    }
  }

  dynamic "statement" {
    for_each = var.terraform_state_bucket_arn != "" ? [var.terraform_state_bucket_arn] : []

    content {
      sid       = "TerraformStateObjects"
      actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      resources = ["${statement.value}/*"]
    }
  }

  dynamic "statement" {
    for_each = var.terraform_lock_table_arn != "" ? [var.terraform_lock_table_arn] : []

    content {
      sid = "TerraformStateLock"
      actions = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:DescribeTable",
      ]
      resources = [statement.value]
    }
  }
}

resource "aws_iam_role_policy" "ci" {
  name   = "${var.name}-github-ci"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.ci.json
}
