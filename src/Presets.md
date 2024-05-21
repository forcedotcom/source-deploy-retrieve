# Available sourceBehaviorOptions

## `decomposePermissionSetBeta`

PermissionSet is decomposed to a folder named after the PermissionSet.

metadata format
`/permissionsets/myPS.permissionset`

source format

```txt
/permissionsets/myPS/myPS.permissionset-meta.xml (the non-decomposed parts)
/permissionsets/myPS/classAccesses/Foo.classAccess-meta.xml
/permissionsets/myPS/classAccesses/...
/permissionsets/myPS/fieldPermissions/Obj__c.Field__c.fieldPermission-meta.xml
/permissionsets/myPS/fieldPermissions/...
```

Each child of PermissionSet that is a repeated xml element (ex: ClassAccesses) is saved as a separate file
Simple fields (ex: `description`, `userLicense`) remain in the top-level `myPS.permissionset-meta.xml`

FieldPermissions for all objects are in the same folder (they're not in sub-folders by object). This is intentional--I wanted subfolders but couldn't get it to work well.

## `decomposeSharingRulesBeta`

SharingRules is decomposed to a folder named after the sharingRules (which is named after an object)

metadata format
`/sharingRules/Account.sharingRules`

source format

```txt
/sharingRules/Account/account.sharingRules-meta.xml (a SharingRules xml node with no contents)
/sharingRules/Account/sharingCriteriaRules/Foo.sharingCriteriaRule-meta.xml
/sharingRules/Account/sharingCriteriaRules/...
/sharingRules/Account/sharingTerritoryRules/Bar.sharingTerritoryRule-meta.xml
/sharingRules/Account/sharingTerritoryRules/...
```

Each child of SharingRules that is a repeated xml element (ex: sharingTerritoryRules) is saved as a separate file
SharingRules has not simple fields, so the top-level `Account.sharingRules-meta.xml` will be an empty xml.

## `decomposeWorkflowBeta`

Workflow is decomposed to a folder named after the Workflow (which is named after an object)

metadata format
`/workflows/Account.workflow`

source format

```txt
/workflows/Account/Account.workflow-meta.xml (the non-decomposed parts)
/workflows/Account/workflowAlerts/emailAlert1.workflowAlert-meta.xml
/workflows/Account/workflowAlerts/...
/workflows/Account/workflowTasks/task1.workflowTask-meta.xml
/workflows/Account/workflowTasks/...
```

Each child of Workflow that is a repeated xml element (ex: workflowAlerts) is saved as a separate file
Simple fields (ex: `fullName`) can remain in the top-level `Account.workflow-meta.xml`. This could also have no children

## `decomposeCustomLabelsBeta`

CustomLabels are decomposed to a folder named `CustomLabels` the labels are then placed into individual files

metadata format
`/labels/CustomLabels.customlabes-meta.xml`

source format

```txt
/labels/CustomLabels/CustomLabels.labels-meta.xml (the non-decomposed parts)
/labels/CustomLabels/a.label-meta.xml
/labels/CustomLabels/b.label-meta.xml
/labels/CustomLabels/c.label-meta.xml
```
