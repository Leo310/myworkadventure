/// <reference types="@workadventure/iframe-api-typings" />

import {bootstrapExtra} from "@workadventure/scripting-api-extra";
import axios from "axios";

console.log('Script started successfully');

let currentPopup: any = undefined;

function getData() {
  const encodedParams = new URLSearchParams();
  encodedParams.append("length", "12");
  encodedParams.append("type", "numeric");
  console.log("hello");

  const options = {
    method : 'POST',
    url : 'https://random-string-generator.p.rapidapi.com/randomstring',
    params : {length : '12', type : 'numeric'},
    headers : {
      'content-type' : 'application/x-www-form-urlencoded',
      'X-RapidAPI-Key' : 'SIGN-UP-FOR-KEY',
      'X-RapidAPI-Host' : 'random-string-generator.p.rapidapi.com'
    },
    data : encodedParams
  };
  axios.request(options)
      .then(function(response) { console.log("DATAAAA: ", response.data); })
      .catch(function(error) { console.error(error); });
}

// Waiting for the API to be ready
WA.onInit()
    .then(() => {
      console.log('Scripting API ready');
      // getData();
      console.log('Player tags: ', WA.player.tags)

      WA.room.onEnterLayer('clockZone').subscribe(() => {
        const today = new Date();
        const time = today.getHours() + ":" + today.getMinutes();
        currentPopup = WA.ui.openPopup("clockPopup", "It's " + time, []);
      })

      WA.room.onLeaveLayer('clockZone').subscribe(closePopUp)

      // The line below bootstraps the Scripting API Extra library that adds a
      // number of advanced properties/features to WorkAdventure
      bootstrapExtra()
          .then(() => { console.log('Scripting API Extra ready'); })
          .catch(e => console.error(e));
    })
    .catch(e => console.error(e));

function closePopUp() {
  if (currentPopup !== undefined) {
    currentPopup.close();
    currentPopup = undefined;
  }
}

export {};
