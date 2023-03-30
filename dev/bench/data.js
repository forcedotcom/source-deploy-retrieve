window.BENCHMARK_DATA = {
  "lastUpdate": 1680187417982,
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
          "id": "19218d3fe878e3d5477b95304f3612ffb8bd5432",
          "message": "test: tests won't collide",
          "timestamp": "2023-03-30T09:39:20-05:00",
          "tree_id": "4c0fea5afcd2951cd4042ab3dee6f33b6b658109",
          "url": "https://github.com/forcedotcom/source-deploy-retrieve/commit/19218d3fe878e3d5477b95304f3612ffb8bd5432"
        },
        "date": 1680187414235,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "eda-componentSetCreate-linux",
            "value": 265.37560700000904,
            "unit": "ms"
          },
          {
            "name": "eda-sourceToMdapi-linux",
            "value": 7195.531338000001,
            "unit": "ms"
          },
          {
            "name": "eda-sourceToZip-linux",
            "value": 5235.586085999996,
            "unit": "ms"
          },
          {
            "name": "eda-mdapiToSource-linux",
            "value": 4659.67283299999,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-componentSetCreate-linux",
            "value": 478.77064599998994,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-sourceToMdapi-linux",
            "value": 10579.102799999993,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-sourceToZip-linux",
            "value": 8291.710246000002,
            "unit": "ms"
          },
          {
            "name": "lotsOfClasses-mdapiToSource-linux",
            "value": 6140.411289999989,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-componentSetCreate-linux",
            "value": 858.5987610000011,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-sourceToMdapi-linux",
            "value": 15805.573957000015,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-sourceToZip-linux",
            "value": 13524.839121000026,
            "unit": "ms"
          },
          {
            "name": "lotsOfClassesOneDir-mdapiToSource-linux",
            "value": 10605.827110999991,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}