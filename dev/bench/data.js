window.BENCHMARK_DATA = {
  "lastUpdate": 1680185907075,
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
      },
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
          "id": "63ed5eac9737c41fc00b658b0161dab020fa43ab",
          "message": "test: append to existing",
          "timestamp": "2023-03-30T09:01:17-05:00",
          "tree_id": "ae2650d505b17e0e30475503df16059fb4f7dd91",
          "url": "https://github.com/forcedotcom/source-deploy-retrieve/commit/63ed5eac9737c41fc00b658b0161dab020fa43ab"
        },
        "date": 1680185182077,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "componentSetCreate",
            "value": 1285.9284740000148,
            "unit": "ms"
          },
          {
            "name": "sourceToMdapi",
            "value": 19021.116727999994,
            "unit": "ms"
          },
          {
            "name": "sourceToZip",
            "value": 15753.72701599996,
            "unit": "ms"
          },
          {
            "name": "mdapiToSource",
            "value": 13797.657760000031,
            "unit": "ms"
          }
        ]
      },
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
          "id": "6094830333ec785aaeee905019de231be47863eb",
          "message": "test: name includes os, which test",
          "timestamp": "2023-03-30T09:04:56-05:00",
          "tree_id": "8231fd536edf657770537f6a2283561c5b3241ad",
          "url": "https://github.com/forcedotcom/source-deploy-retrieve/commit/6094830333ec785aaeee905019de231be47863eb"
        },
        "date": 1680185315294,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "lotsOfClassesOneDir-componentSetCreate-linux",
            "value": 741.9189479999768,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-sourceToMdapi-linux",
            "value": 12101.713676000014,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-sourceToZip-linux",
            "value": 9991.19588699998,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-mdapiToSource-linux",
            "value": 8365.409587000002,
            "unit": "ms"
          }
        ]
      },
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
          "id": "0fca47a3a0c43110a83622198e1301f67946dd18",
          "message": "test: concurrency and windows",
          "timestamp": "2023-03-30T09:14:04-05:00",
          "tree_id": "6d619630ec124be13797e3bb0db83e0e20375373",
          "url": "https://github.com/forcedotcom/source-deploy-retrieve/commit/0fca47a3a0c43110a83622198e1301f67946dd18"
        },
        "date": 1680185903094,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "eda-componentSetCreate-linux",
            "value": 279.4947689999972,
            "unit": "ms"
          },
          {
            "name": "eda-sourceToMdapi-linux",
            "value": 7532.779867000005,
            "unit": "ms"
          },
          {
            "name": "eda-sourceToZip-linux",
            "value": 5938.181852000009,
            "unit": "ms"
          },
          {
            "name": "eda-mdapiToSource-linux",
            "value": 5050.194312000007,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-componentSetCreate-linux",
            "value": 518.3954479999957,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-sourceToMdapi-linux",
            "value": 11588.285965999996,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-sourceToZip-linux",
            "value": 9379.538293999998,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-mdapiToSource-linux",
            "value": 5935.835020999977,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-componentSetCreate-linux",
            "value": 894.7593170000182,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-sourceToMdapi-linux",
            "value": 15605.497822000005,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-sourceToZip-linux",
            "value": 13183.858574999991,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-mdapiToSource-linux",
            "value": 10347.23683899999,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}