"use strict";
// extend this to update the service worker every push
// https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Offline_Service_workers
let cacheName = 'js13kPWA-v1';

// todo test
self.addEventListener('install', function (e) {
  e.waitUntil(async function() {
    await fetch('_static/cache.json')
        .then(response => response.json())
        .then(async (data) => {
          for (let i = 0; i < data.length / 10; i++) {
            const tofetch = data.slice(i * 10, i * 10 + 10);
            await addKeys(tofetch)
          }
        })
  }());
});

// opt for a cache first response, for quickest load times
// we'll still update the page assets in the background
self.addEventListener('fetch', function (event) {
  event.respondWith(async function () {
    let request_url = event.request.url;

    try {
      await addKeys([request_url]) //put in format our addKeys function expects
    } catch (error) {
      console.error("Error downloading from remote:", error)
    }
    
    let res = await getKey(request_url)

    console.log("Fetching:", event.request.url)
    return res;
  }());
});

let dbPromise;

async function getDB() {
  if (dbPromise) {
    return dbPromise;
  } else {
    let request = indexedDB.open("frc-docs", "1")

    dbPromise = new Promise((resolve, reject) => {
      request.onsuccess = function (event) {
        console.log("Successfully opened database!")
        resolve(event.target.result)
      }

      request.onerror = function (event) {
        console.error("Error opening database for getKey():", request.error)
        reject()
      }

      request.onupgradeneeded = function (event) {
        let db = event.target.result;
        db.createObjectStore("urls", { keyPath: 'key' })
      }
    });

    return dbPromise;
  }
}

async function getKey(key) {
  let db = await getDB()
  console.log("Grabbing key", key)
  return new Promise((resolve, reject) => {
    try {
      let transaction = db.transaction("urls").objectStore("urls");
      let request = transaction.get(key)

      request.onsuccess = function (event) {
        let res = request.result;
        console.log("Successfully retrieved result:", res)
        resolve(new Response(res.value));
      }

      request.onerror = function (event) {
        console.error("Error on retrieving blob:", key, request.error)
        reject()
      }

    } catch (ex) {
      console.error(ex.message);
      reject()
    }
  })
}

async function addKeys(datas) {
    let db = await getDB()
    return Promise.all(
      datas.map(async (data) => {
        let fetchedData = await fetch(data)
          .then(x => x.blob())
          .catch((error) => {
            console.error("Error fetching", data)
            return new Promise((resolve, reject) => {
              reject();
            })
          })
        let transaction = db.transaction("urls", "readwrite").objectStore("urls")
        let request = transaction.put({key: data, value: fetchedData})

        return new Promise((resolve, reject) => {
          request.onsuccess = function() {
            resolve()
          }
          request.onerror = function () {
            console.log(request.error)
            reject(request.error)
          }
        });
      })
    );
    // data is already a key/value object with url/data
}