<script lang="ts">
    import { fly } from "svelte/transition";
    import SettingsSubMenu from "./SettingsSubMenu.svelte";
    import ProfileSubMenu from "./ProfileSubMenu.svelte";
    import AboutRoomSubMenu from "./AboutRoomSubMenu.svelte";
    import ContactSubMenu from "./ContactSubMenu.svelte";
    import CustomSubMenu from "./CustomSubMenu.svelte";
    import GuestSubMenu from "./GuestSubMenu.svelte";
    import chevronImg from "../images/chevron.svg";
    import "../../../style/tailwind.scss";

    import {
        activeSubMenuStore,
        checkSubMenuToShow,
        customMenuIframe,
        menuVisiblilityStore,
        SubMenusInterface,
        subMenusStore,
        TranslatedMenu,
    } from "../../Stores/MenuStore";
    import type { MenuItem } from "../../Stores/MenuStore";
    import { onDestroy, onMount } from "svelte";
    import type { Unsubscriber } from "svelte/store";
    import { sendMenuClickedEvent } from "../../Api/iframe/Ui/MenuItem";
    import LL from "../../i18n/i18n-svelte";
    import { analyticsClient } from "../../Administration/AnalyticsClient";

    let activeSubMenu: MenuItem = $subMenusStore[$activeSubMenuStore];
    let activeComponent: typeof ProfileSubMenu | typeof CustomSubMenu = ProfileSubMenu;
    let props: { url: string; allowApi: boolean };
    let unsubscriberSubMenuStore: Unsubscriber;
    let unsubscriberActiveSubMenuStore: Unsubscriber;

    onMount(async () => {
        unsubscriberActiveSubMenuStore = activeSubMenuStore.subscribe((value) => {
            if ($subMenusStore.length >= value - 1) {
                void switchMenu($subMenusStore[value]);
            }
        });
        unsubscriberSubMenuStore = subMenusStore.subscribe(() => {
            if (!$subMenusStore.includes(activeSubMenu)) {
                void switchMenu($subMenusStore[$activeSubMenuStore]);
            }
        });

        checkSubMenuToShow();

        await switchMenu($subMenusStore[$activeSubMenuStore]);
    });

    onDestroy(() => {
        if (unsubscriberSubMenuStore) {
            unsubscriberSubMenuStore();
        }
        if (unsubscriberActiveSubMenuStore) {
            unsubscriberActiveSubMenuStore();
        }
    });

    async function switchMenu(menu: MenuItem) {
        if (menu.type === "translated") {
            activeSubMenu = menu;
            const indexMenuSearch = $subMenusStore.findIndex(
                (menuSearch) => (menuSearch as TranslatedMenu).key === menu.key
            );
            if (indexMenuSearch === -1) {
                console.error(`Sub menu was not founded for key: ${menu.key} in the array: `, $activeSubMenuStore);
                return;
            }
            activeSubMenuStore.set(indexMenuSearch);
            switch (menu.key) {
                case SubMenusInterface.profile:
                    activeComponent = ProfileSubMenu;
                    analyticsClient.menuProfile();
                    break;
                case SubMenusInterface.settings:
                    activeComponent = SettingsSubMenu;
                    analyticsClient.menuSetting();
                    break;
                case SubMenusInterface.invite:
                    activeComponent = GuestSubMenu;
                    analyticsClient.menuInvite();
                    break;
                case SubMenusInterface.aboutRoom:
                    activeComponent = AboutRoomSubMenu;
                    analyticsClient.menuCredit();
                    break;
                case SubMenusInterface.contact:
                    activeComponent = ContactSubMenu;
                    analyticsClient.menuContact();
                    break;
                case SubMenusInterface.globalMessages:
                    activeComponent = (await import("./GlobalMessagesSubMenu.svelte")).default;
                    analyticsClient.globalMessage();
                    break;
            }
        } else {
            const customMenu = customMenuIframe.get(menu.label);
            if (customMenu !== undefined) {
                activeSubMenu = menu;
                props = { url: customMenu.url, allowApi: customMenu.allowApi };
                activeComponent = CustomSubMenu;
            } else {
                sendMenuClickedEvent(menu.label);
                menuVisiblilityStore.set(false);
            }
        }
    }

    function closeMenu() {
        menuVisiblilityStore.set(false);
        activeSubMenuStore.set(0);
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            closeMenu();
        }
    }

    $: subMenuTranslations = $subMenusStore.map((subMenu) =>
        subMenu.type === "scripting" ? subMenu.label : $LL.menu.sub[subMenu.key]()
    );
    $: activeSubMenuTranslation =
        activeSubMenu.type === "scripting" ? activeSubMenu.label : $LL.menu.sub[activeSubMenu.key]();
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="menu-container">
    <div class="menu-nav-sidebar" transition:fly={{ x: -1000, duration: 500 }}>
        <h2 class="tw-p-5 blue-title">{$LL.menu.title()}</h2>
        <nav>
            {#each $subMenusStore as submenu, i}
                <div
                    class="menu-item-container {activeSubMenu === submenu ? 'active' : ''}"
                    on:click|preventDefault={() => switchMenu(submenu)}
                >
                    <button type="button" class="tw-flex menu-item">
                        {subMenuTranslations[i]}
                    </button>
                    <img src={chevronImg} class="menu-icon" alt="open submenu" draggable="false" />
                </div>
            {/each}
        </nav>
    </div>
    <div class="menu-submenu-container tw-bg-dark-purple/95 tw-rounded" transition:fly={{ y: -1000, duration: 500 }}>
        <button type="button" class="close-window" on:click={closeMenu}>&times</button>
        <h2>{activeSubMenuTranslation}</h2>
        <svelte:component this={activeComponent} {...props} />
    </div>
</div>

<style lang="scss">
    @import "../../../style/breakpoints.scss";
</style>
