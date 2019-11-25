let axios = require("axios")
let Semver = require("semver")
let Yaml = require("js-yaml")
let fs = require("fs")
let Toc = require('markdown-toc')
require("dotenv").config()

const modules = [
  "accept",
  "address",
  "ammo",
  "b64",
  "basic",
  "bell",
  "boom",
  "bossy",
  "bounce",
  "bourne",
  "call",
  "catbox",
  "catbox-memcached",
  "catbox-memory",
  "catbox-object",
  "catbox-redis",
  "code",
  "content",
  "cookie",
  "crumb",
  "cryptiles",
  "formula",
  "glue",
  "good",
  "good-console",
  "good-squeeze",
  "h2o2",
  "hawk",
  "hoek",
  "inert",
  "iron",
  "joi",
  "joi-date",
  "lab",
  "mimos",
  "nes",
  "oppsy",
  "pinpoint",
  "podium",
  "rule-capitalize-modules",
  "rule-for-loop",
  "rule-scope-start",
  "scooter",
  "shot",
  "sntp",
  "subtext",
  "topo",
  "vision",
  "wreck",
  "yar"
]
let finalHtmlDisplay = ""
let finalMenu = ""

getInfo()

async function getInfo() {
  let repos = {}
  let newRepos = {}
  const options = {
    headers: {
      accept: "application/vnd.github.v3.raw+json",
      authorization: "token " + process.env.GITHUB_TOKEN
    }
  }
  let repositories = await axios.get(
    "https://api.github.com/orgs/hapijs/repos?per_page=100",
    options
  )
  for (let r = 0; r < repositories.data.length; ++r) {
    let branches = await axios.get(
      "https://api.github.com/repos/hapijs/" +
        repositories.data[r].name +
        "/branches",
      options
    )
    if (
      repositories.data[r].name !== "assets" &&
      repositories.data[r].name !== ".github" &&
      repositories.data[r].name !== "hapi.dev"
    ) {
      repos[repositories.data[r].name] = {
        name: repositories.data[r].name,
        versions: [],
        versionsArray: []
      }
      for (let branch of branches.data) {
        if (branch.name.match(/^v+[0-9]+|\bmaster\b/g)) {
          const gitHubVersion = await axios.get(
            "https://api.github.com/repos/hapijs/" +
              repositories.data[r].name +
              "/contents/package.json?ref=" +
              branch.name,
            options
          )
          const nodeYaml = await axios.get(
            "https://api.github.com/repos/hapijs/" +
              repositories.data[r].name +
              "/contents/.travis.yml?ref=" +
              branch.name,
            options
          )

          //Get API
          try {
            if (modules.includes(repositories.data[r].name)) {
              console.log('https://api.github.com/repos/hapijs/' +
              repositories.data[r].name +
                '/contents/API.md?ref=' +
                branch.name)
              const api = await axios.get(
                'https://api.github.com/repos/hapijs/' +
                repositories.data[r].name +
                  '/contents/API.md?ref=' +
                  branch.name,
                options
              )
              let rawString = await api.data.toString()
    
              //Auto generate TOC
              let apiTocString = ''
              let apiTocArray = await rawString.match(/\n#.+/g)
              let pattern = '####'
    
              for (let i = 0; i < apiTocArray.length; ++i) {
                let testPattern = apiTocArray[i].match(/(?=#)(.*)(?=\s)/)
                if (testPattern[0].length < pattern.length) {
                  pattern = testPattern[0]
                }
                apiTocString = apiTocString + apiTocArray[i]
              }
              apiTocString = apiTocString + '\n' + pattern + ' Changelog'
              finalMenu = Toc(apiTocString, { bullets: '-' }).content
    
              //Split API menu from content
              let finalDisplay = await rawString.replace(/\/>/g, '></a>')
              finalMenu = await finalMenu.replace(/Boom\./g, '')
              finalMenu = await finalMenu.replace(/\(([^#*]+)\)/g, '()')
              const apiHTML = await axios.post(
                'https://api.github.com/markdown',
                {
                  text: finalDisplay,
                  mode: 'markdown'
                },
                {
                  headers: {
                    authorization: 'token ' + process.env.GITHUB_TOKEN
                  }
                }
              )
              let apiString = await apiHTML.data.toString()
              finalHtmlDisplay = await apiString.replace(/user-content-/g, '') 
            }
          } catch (err) {
            console.log(err)
          }


          let nodeVersions = Yaml.safeLoad(nodeYaml.data).node_js.reverse()
          if (
            !repos[repositories.data[r].name].versions.some(
              v =>
                v.branch === "master" && v.name === gitHubVersion.data.version
            ) ||
            gitHubVersion.data.name.includes("commercial")
          ) {
            repos[repositories.data[r].name].versionsArray.push(gitHubVersion.data.version)
            repos[repositories.data[r].name].versions.push({
              name: gitHubVersion.data.version,
              branch: branch.name,
              license: gitHubVersion.data.name.includes("commercial")
                ? "Commercial"
                : "BSD",
              node: nodeVersions.join(", ").replace("node,", ""),
            })
            repos[repositories.data[r].name][gitHubVersion.data.version] = {
              menu: finalMenu,
              api: await finalHtmlDisplay,
              license: gitHubVersion.data.name.includes("commercial")
                ? "Commercial"
                : "BSD",
            }
          }
          await repos[repositories.data[r].name].versions.sort(function(a, b) {
            return Semver.compare(b.name, a.name)
          })
        }
      }
    }

    for (let key of Object.keys(repos)) {
      if (repos[key].versions.length > 1) {
        if (
          repos[key].versions[0].name === repos[key].versions[1].name &&
          repos[key].versions[0].license === "Commercial"
        ) {
          let temp = repos[key].versions[0]
          repos[key].versions[0] = repos[key].versions[1]
          repos[key].versions[1] = temp
        }
      }
    }

    const orderedRepos = {}
    await Object.keys(repos)
      .sort()
      .forEach(function(key) {
        orderedRepos[key] = repos[key]
      })

    let hapi = orderedRepos.hapi

    delete orderedRepos.hapi

    newRepos = await Object.assign({ hapi }, orderedRepos)
  }
  await fs.writeFile('./static/lib/moduleInfo.json', JSON.stringify(newRepos), function(err) {
    if (err) throw err
  })
}

