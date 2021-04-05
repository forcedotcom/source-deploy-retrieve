#!/usr/bin/env bash

# For publishing a different version, see the format below for adding a publish-type
# parameter:
# "publish-type": "minor"

CircleCIToken=$1
PublishType=$2
ScheduledBuild=$3
curl -v -u ${CircleCIToken}: -X POST --header "Content-Type: application/json" -d '{
  "branch": "main",
  "parameters": {
    "publish": true,
    "publish-type": "'"${PublishType}"'",
    "scheduled-build": "'"${ScheduledBuild}"'"
  }
}' https://circleci.com/api/v2/project/gh/forcedotcom/source-deploy-retrieve/pipeline