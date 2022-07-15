/// <reference types="@workadventure/iframe-api-typings" />

import {bootstrapExtra} from "@workadventure/scripting-api-extra";

console.log('Script started successfully');

let currentPopup: any = undefined;

// Waiting for the API to be ready
WA.onInit()
    .then(() => {
      console.log('Scripting API ready');
      // getData();
      console.log('Player tags: ', WA.player.tags)
      WA.room.hideLayer('Eingang Tür auf');
      WA.room.hideLayer('Eingang2 Tür auf');

      WA.room.onEnterLayer('Eingang Tür Zone').subscribe(() => {
        if (WA.player.state.access as Number >= 1) {

          WA.room.hideLayer('Eingang Tür zu');
          WA.room.showLayer('Eingang Tür auf');
        } else {

          currentPopup = WA.ui.openPopup('Eingang Popup', "No Access!", []);
        }
      })

      WA.room.onLeaveLayer('Eingang Tür Zone').subscribe(() => {
        closePopUp();

        WA.room.showLayer('Eingang Tür zu');
        WA.room.hideLayer('Eingang Tür auf');
      })

      WA.room.onEnterLayer('Eingang2 Tür Zone').subscribe(() => {
        if (WA.player.state.access as Number >= 1) {

          WA.room.hideLayer('Eingang2 Tür zu');
          WA.room.showLayer('Eingang2 Tür auf');
        } else {

          currentPopup = WA.ui.openPopup('Eingang2 Popup', "No Access!", []);
        }
      })

      WA.room.onLeaveLayer('Eingang2 Tür Zone').subscribe(() => {
        closePopUp();

        WA.room.hideLayer('Eingang2 Tür auf');
        WA.room.showLayer('Eingang2 Tür zu');
      })

      WA.chat.onChatMessage((mes) => {
        var zone = WA.player.state.chatZone;

        console.log(zone);
        console.log(mes);

        if (zone == "") {
          return;
        } else if (zone == "kitchen") {

          if (mes.toLowerCase() == "hummer") {
            WA.chat.sendChatMessage("Guten Appetit!", "Mitarbeiter");
          } else if (mes.toLocaleLowerCase() == "hühnchen") {
            WA.chat.sendChatMessage("Guten Appetit!", "Mitarbeiter");
          } else if (mes.toLocaleLowerCase() == "nudeln") {
            WA.chat.sendChatMessage("Guten Appetit!", "Mitarbeiter");
          } else {
            WA.chat.sendChatMessage(
                "Das habe ich leider nicht verstanden...Kannst du das wiederholen?",
                "Mitarbeiter")
          }
        } else if (zone == "secretary") {

          if (mes.toLowerCase() == "daily badge") {

            WA.chat.sendChatMessage(
                'Wilst du eine Badge abgeben oder ausleihen?', "Sekretärin");

          } else if (mes.toLocaleLowerCase() == "auskunft") {
            WA.chat.sendChatMessage(
                "Wenn du Hilfe brauchst guck dir am besten das Info Video an. Bei weiteren Fragen komm gerne zu mir",
                "Sekretärin");
          } else if (mes.toLocaleLowerCase() == "covid test") {
            WA.chat.sendChatMessage("Dein Test ist negativ. Bleib gesund!",
                                    "Sekretär*in");
          } else if (mes.toLocaleLowerCase() == "abgeben") {

            WA.player.state.access = 0;
            WA.chat.sendChatMessage(
                'Dankeschön. Du hast nun kein Zutritt mehr. Vergiss morgen deine Badge nicht',
                "Sekretärin");
          } else if (mes.toLocaleLowerCase() == "ausleihen") {

            WA.player.state.access = 1;
            WA.chat.sendChatMessage(
                "Hier ist dein Daily Badge. Du hast nun Zutritt zum Gebäude." +
                    "Vergiss nicht die Badge am Ende des Tages wieder abzugeben!",
                "Sekretärin");
          } else {
            WA.chat.sendChatMessage(
                "Das habe ich leider nicht verstanden...Kannst du das wiederholen?",
                "Mitarbeiter")
          }
        }
      })
      WA.room.onEnterLayer('Secretary Zone').subscribe(() => {
        WA.player.state.chatZone = "secretary";

        console.log(WA.player.state.chatZone);
        WA.chat.sendChatMessage(
            'Hallo wie kann ich dir helfen? Ich kann dir eine Auskunft geben, dir eine Daily Badge ausleihen oder einen Covid Test machen.',
            "Sekretaer*in");
      })
      WA.room.onEnterLayer('Kitchen Zone').subscribe(() => {
        WA.player.state.chatZone = "kitchen"
        WA.chat.sendChatMessage(
            'Hier ist die Cafeteria. Wollen Sie Hummer, Hühnchen oder Nudeln?',
            "Mitarbeiter");
      })

      WA.room.onLeaveLayer('Kitchen Zone')
          .subscribe(() => { WA.player.state.chatZone = ""; })
      WA.room.onLeaveLayer('Secretary Zone')
          .subscribe(() => { WA.player.state.chatZone = ""; })

      // WA.room.onEnterLayer('clockZone').subscribe(() => {
      //   const today = new Date();
      //   const time = today.getHours() + ":" + today.getMinutes();
      //   currentPopup = WA.ui.openPopup("clockPopup", "It's " + time, []);
      // })

      // WA.room.onLeaveLayer('clockZone').subscribe(closePopUp)

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
