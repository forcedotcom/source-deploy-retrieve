# Publishing

This is a guide for publishing the Source Deploy Retrieve Library to npm. Most contributors will not need to worry about publishing.

## Prerequisites

1. Publisher has a valid CircleCI token for the forcedotcom organization. More info on CircleCI's doc [Create a Personal API token](https://circleci.com/docs/2.0/managing-api-tokens/#creating-a-personal-api-token).
1. Publisher is a part of the GitHub team 'PDT'.

## Generate the Change Log

Add an entry to the `CHANGELOG.md` that includes the date for publishing, the version bump, and the list of changes going out for the release.

## Porting Changes

After feature/bug work has been QA'd and closed, it's time to prepare those changes for publishing.

The source-deploy-retrieve project uses a two branch strategy. Work that is currently under development is committed to the 'develop' branch. Whereas the 'main' branch is what's currently in production or is being staged for production.

To port changes from the develop branch to main we utilize a script called `port-changes.js`. This script is configured with a task to make it easy to trigger from the VSCode Command Palette. This script will determine the changes that need to be ported from develop to main. It will also create the port branch with the specified version bump and cherry-pick the commits we want to port.

### Steps

1. Open the Command Palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS)
1. Search for `Tasks: Run Task`
1. Select `Create Port PR for Publishing`
1. Select `-v` to see the full output.
1. Select the type of version bump. Typically using the default value of `patch` is fine.
1. Push your branch up with `git push origin <branchName>` and open the pull request for review.

In the event that a change was ported that wasn't ready for production, we would want to remove it from the port branch. To remove commit(s) from the port branch...

1. Checkout branch portPR-v...
1. Run `git rebase -i HEAD~<NumberOfPortedCommits>`. For example: `git rebase -i HEAD~5`
1. Replace 'pick' with 'drop' for any commit that you want to exclude from the port branch.
1. Exit the editor with `Ctrl + c`.
1. Save the changes with `:wq`.

## Publishing to NPM

To publish the changes to npm, we run the task `Publish Source Deploy Retrieve Library`. This task will call the script `publish-workflow.sh` and prompt the user for the required information. The publish-workflow script generates an HTTP Request to the CircleCI API. It tells CircleCI that it wants to run the `publish-workflow` from the `main` branch.

### Prerequisites

1. All staged changes have been QA'd and Closed.
1. All staged changes have the appropriate scheduled build associated with their Work Item in GUS. This scheduled build value would match the scheduled build going out for the VSCode Extensions. It's okay that this version is not the same as the one for Source Deploy Retrieve.
1. CHANGELOG.md has been updated with the information for this latest release.
1. Port PR has been merged into main and the commit-workflow has succeed.

### Steps

1. Open the Command Palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS)
1. Search for `Tasks: Run Task`
1. Select `Publish Source Deploy Retrieve Library`
1. Enter in your CircleCI Token.
1. Once the request has been sent, approve the workflow in CircleCI. Note only members of the GitHub team 'PDT' can approve the workflow.

## Post Publish

After the publish has succeed, we want to port the version bump in main back to develop.

### Steps

1. Grab the latest version bump commit from main: `git log -n 1 --pretty=format:"%h" main`
1. Create a new branch to port the change to develop: `git checkout -b portToDevelop-<versionNumber> develop`
1. Cherry-pick the latest commit number from step 1: `git cherry-pick <hash>`
1. Push your port branch up to origin: `git push origin portToDevelop-<versionNumber>`
1. Open your PR for review.
