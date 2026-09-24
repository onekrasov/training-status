# AWS deployment

The deployment uses Terraform modules driven by Terragrunt:

- `infrastructure/modules/training-status` contains AWS resources.
- `infrastructure/live/root.hcl` configures encrypted S3 remote state and DynamoDB locking.
- `infrastructure/live/prod` is the single live environment.
- `.github/workflows/deploy.yml` builds the processor, packages Lambda, and runs `terragrunt apply`.

## AWS resources

The environment creates:

- private S3 buckets for raw data, processed data, and the static web site
- a Node.js 22 Lambda processing job
- an EventBridge Scheduler invocation every minute
- CloudFront with Origin Access Control for the private web bucket
- a GitHub Actions OIDC deployment role

The processor mirrors `data/training-status.json` into the web bucket so the existing same-origin browser path works in production.

## One-time bootstrap

The first infrastructure apply must be performed by an AWS identity that can create IAM roles and the GitHub OIDC provider. GitHub cannot assume the deployment role until that first apply succeeds.

From the repository root:

```bash
npm ci
npm run package:lambda
cd infrastructure/live/prod
export GITHUB_REPOSITORY="onekrasov/training-status"
terragrunt init
terragrunt apply
```

Terragrunt will create the remote state bucket and lock table when the configured AWS identity allows it. Review the plan before applying.

After the first apply, copy the `github_actions_role_arn` output into the GitHub repository secret `AWS_DEPLOY_ROLE_ARN`.

## Populate Strava secret

Terraform creates the secret container but does not receive or store its value. After the first apply, populate it directly in AWS:

```bash
aws secretsmanager put-secret-value \
	--secret-id training-status/prod/strava \
	--secret-string '{"clientId":"...","clientSecret":"...","refreshToken":"..."}'
```

The Lambda reads this JSON at invocation time. Local development continues to use `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `STRAVA_REFRESH_TOKEN` from `.env` because `STRAVA_SECRET_ARN` is absent locally.

## GitHub secrets

Create these repository secrets:

- `AWS_DEPLOY_ROLE_ARN`

The workflow uses GitHub OIDC. No long-lived AWS access key is stored in GitHub.

## Routine deployment

Push to `main` or run the workflow manually. The workflow runs:

```bash
npm ci
npm run build
node scripts/package-lambda.mjs
cd infrastructure/live/prod
terragrunt apply --non-interactive
```

The Terraform state contains the secret ARN but not the Strava secret value. Protect the remote state bucket and the Secrets Manager secret with least-privilege IAM.
