<script lang="ts">
    import { localUserStore } from "../../Connexion/LocalUserStore";
    import { videoConstraintStore } from "../../Stores/MediaStore";
    import { HtmlUtils } from "../../WebRtc/HtmlUtils";
    import { menuVisiblilityStore } from "../../Stores/MenuStore";
    import LL, { locale } from "../../i18n/i18n-svelte";
    import type { Locales } from "../../i18n/i18n-types";
    import { displayableLocales, setCurrentLocale } from "../../i18n/locales";
    import { isMediaBreakpointUp } from "../../Utils/BreakpointsUtils";
    import { audioManagerVolumeStore } from "../../Stores/AudioManagerStore";

    import infoImg from "../images/info.svg";

    let fullscreen: boolean = localUserStore.getFullscreen();
    let notification: boolean = localUserStore.getNotification() === "granted";
    let forceCowebsiteTrigger: boolean = localUserStore.getForceCowebsiteTrigger();
    let ignoreFollowRequests: boolean = localUserStore.getIgnoreFollowRequests();
    let decreaseAudioPlayerVolumeWhileTalking: boolean = localUserStore.getDecreaseAudioPlayerVolumeWhileTalking();
    let valueGame: number = localUserStore.getGameQualityValue();
    let valueVideo: number = localUserStore.getVideoQualityValue();
    let valueLocale: string = $locale;
    let valueCameraPrivacySettings = localUserStore.getCameraPrivacySettings();
    let valueMicrophonePrivacySettings = localUserStore.getMicrophonePrivacySettings();

    let previewValueGame = valueGame;
    let previewValueVideo = valueVideo;
    let previewValueLocale = valueLocale;
    let previewCameraPrivacySettings = valueCameraPrivacySettings;
    let previewMicrophonePrivacySettings = valueMicrophonePrivacySettings;

    async function saveSetting() {
        let change = false;

        if (valueLocale !== previewValueLocale) {
            previewValueLocale = valueLocale;
            await setCurrentLocale(valueLocale as Locales);
        }

        if (valueVideo !== previewValueVideo) {
            previewValueVideo = valueVideo;
            videoConstraintStore.setFrameRate(valueVideo);
        }

        if (valueGame !== previewValueGame) {
            previewValueGame = valueGame;
            localUserStore.setGameQualityValue(valueGame);
            change = true;
        }

        if (valueCameraPrivacySettings !== previewCameraPrivacySettings) {
            previewCameraPrivacySettings = valueCameraPrivacySettings;
            localUserStore.setCameraPrivacySettings(valueCameraPrivacySettings);
        }

        if (valueMicrophonePrivacySettings !== previewMicrophonePrivacySettings) {
            previewMicrophonePrivacySettings = valueMicrophonePrivacySettings;
            localUserStore.setMicrophonePrivacySettings(valueMicrophonePrivacySettings);
        }

        audioManagerVolumeStore.setDecreaseWhileTalking(decreaseAudioPlayerVolumeWhileTalking);

        if (change) {
            window.location.reload();
        }

        closeMenu();
    }

    function changeFullscreen() {
        const body = HtmlUtils.querySelectorOrFail("body");
        if (body) {
            if (document.fullscreenElement !== null && !fullscreen) {
                document.exitFullscreen().catch((e) => console.error(e));
            } else {
                body.requestFullscreen().catch((e) => console.error(e));
            }
            localUserStore.setFullscreen(fullscreen);
        }
    }

    function changeNotification() {
        if (Notification.permission === "granted") {
            localUserStore.setNotification(notification ? "granted" : "denied");
        } else {
            Notification.requestPermission()
                .then((response) => {
                    if (response === "granted") {
                        localUserStore.setNotification(notification ? "granted" : "denied");
                    } else {
                        localUserStore.setNotification("denied");
                        notification = false;
                    }
                })
                .catch((e) => console.error(e));
        }
    }

    function changeForceCowebsiteTrigger() {
        localUserStore.setForceCowebsiteTrigger(forceCowebsiteTrigger);
    }

    function changeIgnoreFollowRequests() {
        localUserStore.setIgnoreFollowRequests(ignoreFollowRequests);
    }

    function changeDecreaseAudioPlayerVolumeWhileTalking() {
        localUserStore.setDecreaseAudioPlayerVolumeWhileTalking(decreaseAudioPlayerVolumeWhileTalking);
    }

    function closeMenu() {
        menuVisiblilityStore.set(false);
    }

    const isMobile = isMediaBreakpointUp("md");
</script>

<div on:submit|preventDefault={saveSetting}>
    <section class="bottom-separator">
        <h3 class="blue-title">{$LL.menu.settings.gameQuality.title()}</h3>
        <select bind:value={valueGame} class="tw-w-full">
            <option value={120}
                >{isMobile
                    ? $LL.menu.settings.gameQuality.short.high()
                    : $LL.menu.settings.gameQuality.long.high()}</option
            >
            <option value={60}
                >{isMobile
                    ? $LL.menu.settings.gameQuality.short.medium()
                    : $LL.menu.settings.gameQuality.long.medium()}</option
            >
            <option value={40}
                >{isMobile
                    ? $LL.menu.settings.gameQuality.short.small()
                    : $LL.menu.settings.gameQuality.long.small()}</option
            >
            <option value={20}
                >{isMobile
                    ? $LL.menu.settings.gameQuality.short.minimum()
                    : $LL.menu.settings.gameQuality.long.minimum()}</option
            >
        </select>
        <h3 class="blue-title">{$LL.menu.settings.videoQuality.title()}</h3>
        <select bind:value={valueVideo} class="tw-w-full">
            <option value={30}
                >{isMobile
                    ? $LL.menu.settings.videoQuality.short.high()
                    : $LL.menu.settings.videoQuality.long.high()}</option
            >
            <option value={20}
                >{isMobile
                    ? $LL.menu.settings.videoQuality.short.medium()
                    : $LL.menu.settings.videoQuality.long.medium()}</option
            >
            <option value={10}
                >{isMobile
                    ? $LL.menu.settings.videoQuality.short.small()
                    : $LL.menu.settings.videoQuality.long.small()}</option
            >
            <option value={5}
                >{isMobile
                    ? $LL.menu.settings.videoQuality.short.minimum()
                    : $LL.menu.settings.videoQuality.long.minimum()}</option
            >
        </select>
        <h3 class="blue-title">{$LL.menu.settings.language.title()}</h3>
        <select class="tw-w-full languages-switcher" bind:value={valueLocale}>
            {#each displayableLocales as locale (locale.id)}
                <option value={locale.id}>{`${locale.language} (${locale.region})`}</option>
            {/each}
        </select>

        <div class="centered-column">
            <p>{$LL.menu.settings.save.warning()}</p>
            <button type="button" class="light" on:click|preventDefault={saveSetting}
                >{$LL.menu.settings.save.button()}</button
            >
        </div>
    </section>
    <section class="bottom-separator tw-flex tw-flex-col">
        <div class="tooltip tw-w-fit">
            <h3 class="blue-title tw-underline tw-decoration-light-blue tw-decoration-dotted">
                {$LL.menu.settings.privacySettings.title()}
                <img draggable="false" src={infoImg} alt="info icon" width="18px" height="18px" />
            </h3>
            <span class="tooltiptext sm:tw-w-56 md:tw-w-96">{$LL.menu.settings.privacySettings.explanation()}</span>
        </div>
        <label>
            <input type="checkbox" bind:checked={valueCameraPrivacySettings} />
            {$LL.menu.settings.privacySettings.cameraToggle()}
        </label>
        <label>
            <input type="checkbox" bind:checked={valueMicrophonePrivacySettings} />
            {$LL.menu.settings.privacySettings.microphoneToggle()}
        </label>
    </section>
    <section class="tw-flex tw-flex-col">
        <label>
            <input type="checkbox" bind:checked={fullscreen} on:change={changeFullscreen} />
            <span>{$LL.menu.settings.fullscreen()}</span>
        </label>
        <label>
            <input type="checkbox" bind:checked={notification} on:change={changeNotification} />
            <span>{$LL.menu.settings.notifications()}</span>
        </label>
        <label>
            <input type="checkbox" bind:checked={forceCowebsiteTrigger} on:change={changeForceCowebsiteTrigger} />
            <span>{$LL.menu.settings.cowebsiteTrigger()}</span>
        </label>
        <label>
            <input type="checkbox" bind:checked={ignoreFollowRequests} on:change={changeIgnoreFollowRequests} />
            <span>{$LL.menu.settings.ignoreFollowRequest()}</span>
        </label>
        <label>
            <input
                type="checkbox"
                bind:checked={decreaseAudioPlayerVolumeWhileTalking}
                on:change={changeDecreaseAudioPlayerVolumeWhileTalking}
            />
            <span>{$LL.audio.manager.reduce()}</span>
        </label>
    </section>
</div>

<style lang="scss">
    @import "../../../style/breakpoints.scss";
</style>
