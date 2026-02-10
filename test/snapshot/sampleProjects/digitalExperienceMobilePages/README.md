The way this test works is a little complicated. What's happening here is as follows:

- `force-app` contains a source-formatted project with the folder `main/default/digitalExperiences/site/DemoSite/sfdc_cms__view/demo1/mobile` containing a `mobile.json` file
- `force-app-destination` is identical except it lacks this folder
- The snapshot test merges `force-app` into `force-app-destination` and verifies that the `mobile.json` file is placed into a `mobile` folder instead of placed at the root of the `demo1` page

This snapshot locks in the fix for @W-20967044@
