# Project specification

The goal of this project is to provide training score / readines based on past workouts from strava.

## Module 1 - processing job:
- Typescript back-end code deployed lambda functions (terraform);
- Module runs using cloudwatch (every minute);
- Module downloads workouts data into s3 bucket;
- if workout already present in s3, module skips;
- module keeps index.json file to keep track on downloaded workouts;
- it downloads training zones (power and heart rate, pace if available);
- module analyses last 42 days of workouts to calculate TSS.
-- In case workout has power reading it becomes the main source of calculation;
-- if power is missing, heart rate is used as main source;
-- if heart rate is missing, it uses pace zones;
- Module should be able to handle swimming, running, cycling, gym, hiking, yoga;
- Due to difference in TSS for gym and yoga, it should adjust calculation to keep them realistic;
- Result of calculation is stored in s3 bucket so module 2 can pull it using http calls;

## Module 2 - web ui:
- website is deployed and served from s3 bucket (html, css and js as single file to reduce load time);
- website is using json file stored in s3 provided by module 1;

## CICD:
- Uses github pipelines to deploy modules to AWS;
- AWS keys and strava token are stored as secrets in github;

## AWS account
- 126652441520
- Advise if we should use OIDC or other method to deploy module 1 & 2;

## Local development
- Replicates AWS services locally using localstack;
- Allows running both modules and testing e2e;
- Uses .env to store required tokens.