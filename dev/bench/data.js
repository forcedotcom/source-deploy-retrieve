window.BENCHMARK_DATA = {
  "lastUpdate": 1680184406608,
  "repoUrl": "https://github.com/forcedotcom/source-deploy-retrieve",
  "entries": {
    "Benchmark": [
      {
        "commit": {
          "author": {
            "email": "shane.mclaughlin@salesforce.com",
            "name": "mshanemc",
            "username": "mshanemc"
          },
          "committer": {
            "email": "shane.mclaughlin@salesforce.com",
            "name": "mshanemc",
            "username": "mshanemc"
          },
          "distinct": true,
          "id": "d32cb173fb806de405cc963a53ce7ef25f9fc303",
          "message": "ci: no external path",
          "timestamp": "2023-03-30T08:50:34-05:00",
          "tree_id": "79b76504d90be9404526fb3493ac0712606ca474",
          "url": "https://github.com/forcedotcom/source-deploy-retrieve/commit/d32cb173fb806de405cc963a53ce7ef25f9fc303"
        },
        "date": 1680184403708,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "componentSetCreate",
            "value": 728.7269800000358,
            "unit": "ms"
          },
          {
            "name": "sourceToMdapi",
            "value": 10613.525267999968,
            "unit": "ms"
          },
          {
            "name": "sourceToZip",
            "value": 9557.027434999996,
            "unit": "ms"
          },
          {
            "name": "mdapiToSource",
            "value": 6947.633297000022,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}