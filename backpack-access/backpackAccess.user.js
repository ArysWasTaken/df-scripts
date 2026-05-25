// ==UserScript==
// @name         DF Backpack Access
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Shows the backpack inventory on the Storage, Marketplace and Crafting pages
// @author       Arys
// @match        https://fairview.deadfrontier.com/onlinezombiemmo/index.php?page=50
// @match        https://fairview.deadfrontier.com/onlinezombiemmo/index.php?page=35
// @match        https://fairview.deadfrontier.com/onlinezombiemmo/index.php?page=59
// @grant        GM_addStyle
// @grant        GM.addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      localhost
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/gh/ArysWasTaken/df-scripts@main/requestHandler.js
// @require      https://cdn.jsdelivr.net/gh/ArysWasTaken/df-scripts@ff95aae3019f165e418a1f40141ba2a3277d0c69/backpack-access/inventoryTransactionHandler.js
// ==/UserScript==

(function () {
  "use strict";

  /* global makeRequest, InventoryItem, executeInventoryTransaction, reloadStorage */

  let userVars, globalData;

  let invController;

  let rafId = null;

  let isDragging = false;
  const mouseStartCoords = { x: 0, y: 0 };
  const mouseCurrentCoords = { x: 0, y: 0 };
  const dragElementOffset = { x: 0, y: 0 };
  const dragElementOffsetFromInvController = { x: 0, y: 0 };
  const DRAG_THRESHOLD = 25;

  let replaceeToken = null;
  let currentItemToken = null;

  let backpackMenu, backpackLabel, backpackWrapper;

  const BACKPACKWRAPPERSHOWN_VAR_NAME = "backpackWrapperShown";
  const BACKPACKMENUPOSITION_VAR_NAME = "backpackMenuPosition";

  let resizeTimer;

  function getDragElementBounds() {
    return {
      maxX: window.innerWidth - backpackMenu.offsetWidth,
      maxY: window.innerHeight - backpackMenu.offsetHeight,
    };
  }

  function dragElementStart(e) {
    if (!invController) {
      invController = document.getElementById("invController");
      if (!invController) return;
    }

    const mouseOverElement = document.elementFromPoint(e.clientX, e.clientY);

    if (
      mouseOverElement &&
      mouseOverElement.id !== "backpackMenu" &&
      mouseOverElement.id !== "backpackWrapper" &&
      mouseOverElement.id !== "backpackLabel" &&
      mouseOverElement.id !== "backpackdisplay"
    ) {
      return;
    }

    const rect = backpackMenu.getBoundingClientRect();

    dragElementOffset.x = e.clientX - rect.left;
    dragElementOffset.y = e.clientY - rect.top;

    mouseStartCoords.x = e.clientX;
    mouseStartCoords.y = e.clientY;
    isDragging = false;

    window.addEventListener("mousemove", dragElementMove);
    window.addEventListener("touchmove", dragElementMove);

    window.addEventListener("mouseup", dragElementEnd);
    window.addEventListener("touchend", dragElementEnd);
  }

  function dragElementMove(e) {
    const xDistance = e.clientX - mouseStartCoords.x;
    const yDistance = e.clientY - mouseStartCoords.y;
    const sqrDistance = xDistance ** 2 + yDistance ** 2;

    if (sqrDistance <= DRAG_THRESHOLD) return;

    isDragging = true;

    document.body.classList.add("arys-is-dragging");

    mouseCurrentCoords.x = e.clientX;
    mouseCurrentCoords.y = e.clientY;

    if (!rafId) {
      rafId = requestAnimationFrame(updateDragElementPosition);
    }
  }

  function updateDragElementPosition() {
    const bounds = getDragElementBounds();

    const newX = mouseCurrentCoords.x - dragElementOffset.x;
    const newY = mouseCurrentCoords.y - dragElementOffset.y;

    const clampedX = Math.max(0, Math.min(newX, bounds.maxX));
    const clampedY = Math.max(0, Math.min(newY, bounds.maxY));

    const invControllerRect = invController.getBoundingClientRect();

    dragElementOffsetFromInvController.x = clampedX - invControllerRect.left;
    dragElementOffsetFromInvController.y = clampedY - invControllerRect.top;

    const percentX = (clampedX / window.innerWidth) * 100;
    const percentY = (clampedY / window.innerHeight) * 100;

    backpackMenu.style.position = "fixed";
    backpackMenu.style.left = `${percentX}%`;
    backpackMenu.style.top = `${percentY}%`;

    GM_setValue(BACKPACKMENUPOSITION_VAR_NAME, {
      x: backpackMenu.style.left,
      y: backpackMenu.style.top,
    });

    rafId = null;
  }

  function dragElementEnd(e) {
    window.removeEventListener("mousemove", dragElementMove);
    window.removeEventListener("touchmove", dragElementMove);

    window.removeEventListener("mouseup", dragElementEnd);
    window.removeEventListener("touchend", dragElementEnd);

    if (!isDragging) {
      const mouseOverElement = document.elementFromPoint(e.clientX, e.clientY);

      if (mouseOverElement && mouseOverElement.id === "backpackLabel") {
        toggleBackpackWrapper();
      }
    }

    isDragging = false;

    document.body.classList.remove("arys-is-dragging");
  }

  function toggleBackpackWrapper() {
    if (backpackWrapper.classList.contains("arys-hidden")) {
      backpackWrapper.classList.remove("arys-hidden");
      GM_setValue(BACKPACKWRAPPERSHOWN_VAR_NAME, true);
    } else {
      backpackWrapper.classList.add("arys-hidden");
      GM_setValue(BACKPACKWRAPPERSHOWN_VAR_NAME, false);
    }
  }

  function repositionDragElement() {
    if (!invController) {
      invController = document.getElementById("invController");
    }

    const invControllerRect = invController.getBoundingClientRect();

    const bounds = getDragElementBounds();

    const newX = invControllerRect.left + dragElementOffsetFromInvController.x;
    const newY = invControllerRect.top + dragElementOffsetFromInvController.y;

    const clampedX = Math.max(0, Math.min(newX, bounds.maxX));
    const clampedY = Math.max(0, Math.min(newY, bounds.maxY));

    backpackMenu.style.left = `${clampedX}px`;
    backpackMenu.style.top = `${clampedY}px`;

    GM_setValue(BACKPACKMENUPOSITION_VAR_NAME, {
      x: backpackMenu.style.left,
      y: backpackMenu.style.top,
    });
  }

  function backpackWithdrawClick(e) {
    let iBackpack = new InventoryItem(userVars.DFSTATS_df_backpack);
    let totalCurrentBackpackSlots = parseInt(globalData[iBackpack.type].slots);
    if (typeof iBackpack.stats !== "undefined") {
      totalCurrentBackpackSlots += parseInt(iBackpack.stats);
    }

    let totalItemsInPack = 0;
    for (let i = 1; i <= totalCurrentBackpackSlots; i++) {
      if (
        typeof userVars["DFSTATS_df_backpack" + i + "_type"] !== "undefined" &&
        userVars["DFSTATS_df_backpack" + i + "_type"].length > 0
      ) {
        if (!unsafeWindow.lockedSlots.includes(1050 + i + "")) {
          totalItemsInPack++;
        }
      }
    }

    let freeInventorySlots = 0;
    for (let i = 1; i <= userVars.DFSTATS_df_invslots; i++) {
      if (
        typeof userVars["DFSTATS_df_inv" + i + "_type"] === "undefined" ||
        userVars["DFSTATS_df_inv" + i + "_type"].length === 0
      ) {
        freeInventorySlots++;
      }
    }

    if (freeInventorySlots >= totalItemsInPack) {
      let requestParams = {
        pagetime: userVars.pagetime,
        templateID: userVars.template_ID,
        sc: userVars.sc,
        creditsnum: userVars.DFSTATS_df_credits,
        buynum: "0",
        renameto: "undefined`undefined",
        expected_itemprice: "-1",
        expected_itemtype2: "",
        expected_itemtype: "",
        itemnum2: "",
        itemnum: "",
        price: unsafeWindow.getUpgradePrice(),
        gv: 21,
        userID: userVars.userID,
        password: userVars.password,
        action: "empty",
      };

      unsafeWindow.playSound("swap");
      makeRequest("hotrods/backpack", requestParams, reloadStorage);
    }
  }

  function backpackWithdrawMouseMove(e) {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();

    if (target.disabled) {
      switch (target.dataset.pmoverride) {
        case "lock":
          unsafeWindow.displayPlacementMessage(
            "No movable items",
            rect.left,
            rect.bottom + 12,
            "ERROR",
          );
          break;
        default:
          unsafeWindow.displayPlacementMessage(
            "Too many items",
            rect.left,
            rect.bottom + 12,
            "ERROR",
          );
          break;
      }
    }
  }

  function createBackpackUI() {
    GM.addStyle(
      `
            .arys-backpack-menu {
              display: flex;
              flex-direction: column;
              position: absolute;
              left: 28px;
              top: 5px;
              max-width: 132px;
              width: 132px;
              padding: 5px;
              background-color: rgba(0,0,0,.9);
              border: 2px solid #990000;
              z-index: 10;
            }

            .arys-hidden {
              display: none;
            }

            .arys-item {
              z-index: 11 !important;
            }

            .arys-is-dragging {
              user-select: none;
              -webkit-user-select: none;
            }
            `,
    );

    backpackMenu = document.createElement("div");
    backpackMenu.id = "backpackMenu";
    backpackMenu.classList.add("arys-backpack-menu", "arys-hidden");
    const cachedBackpackMenuPosition = GM_getValue(
      BACKPACKMENUPOSITION_VAR_NAME,
      null,
    );
    if (cachedBackpackMenuPosition != null) {
      backpackMenu.style.position = "fixed";
      backpackMenu.style.left = cachedBackpackMenuPosition.x;
      backpackMenu.style.top = cachedBackpackMenuPosition.y;
    }

    backpackLabel = document.createElement("button");
    backpackLabel.id = "backpackLabel";
    backpackMenu.appendChild(backpackLabel);

    backpackWrapper = document.createElement("div");
    backpackWrapper.id = "backpackWrapper";
    backpackWrapper.style.margin = "8px 0 0";
    if (GM_getValue(BACKPACKWRAPPERSHOWN_VAR_NAME, false) === false) {
      backpackWrapper.classList.add("arys-hidden");
    }
    backpackMenu.appendChild(backpackWrapper);

    let backpackWindow = document.createElement("table");
    backpackWindow.id = "backpackdisplay";
    backpackWrapper.appendChild(backpackWindow);

    let backpackWithdraw = document.createElement("button");
    backpackWithdraw.id = "backpackWithdraw";
    backpackWithdraw.textContent = "Move All to Inventory";
    backpackWithdraw.dataset.pmoverride = "";
    backpackWithdraw.style.margin = "8px 0 0";
    backpackWithdraw.style.display = "none";
    backpackWithdraw.disabled = true;
    backpackWithdraw.addEventListener("click", backpackWithdrawClick);
    backpackWithdraw.addEventListener("mousemove", backpackWithdrawMouseMove);

    if (
      typeof userVars.DFSTATS_df_backpack === "undefined" ||
      userVars.DFSTATS_df_backpack.length === 0
    ) {
      backpackMenu.style.display = "none";
    }

    backpackWrapper.appendChild(backpackWithdraw);

    return backpackMenu;
  }

  function dragStart(e) {
    unsafeWindow.dragStart(e);

    if (unsafeWindow.currentItem) {
      unsafeWindow.currentItem.classList.add("arys-item");
    }

    if (unsafeWindow.fakeGrabbedItem) {
      unsafeWindow.fakeGrabbedItem.classList.add("arys-item");
    }
  }

  function dragEnd(e) {
    if (unsafeWindow.fakeGrabbedItem) {
      unsafeWindow.fakeGrabbedItem.classList.remove("arys-item");
    }
  }

  function snapshotStyles(el) {
    if (!el) return null;
    return {
      el,
      position: el.style.position,
      left: el.style.left,
      top: el.style.top,
    };
  }

  function applyFixed(el, left, top) {
    if (!el) return;
    el.style.position = "fixed";
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.classList.add("arys-item");
  }

  function restoreStyles(token) {
    if (!token) return;
    const { el, position, left, top } = token;
    el.style.position = position;
    el.style.left = left;
    el.style.top = top;
    el.classList.remove("arys-item");
  }

  // This is a modified override for updateInventory function from inventory.js
  // This function now handles backpack <-> storage transfers
  function updateInventory(itemSlots) {
    unsafeWindow.promptLoading();
    unsafeWindow.df_prompt.parentNode.style.display = "block";

    const requestParams = {
      pagetime: userVars.pagetime,
      templateID: userVars.template_ID,
      sc: userVars.sc,
      creditsnum: userVars.DFSTATS_df_credits,
      buynum: "0",
      renameto: "undefined`undefined",
      expected_itemprice: "-1",
      price: unsafeWindow.getUpgradePrice(),
      gv: 21,
      userID: userVars.userID,
      password: userVars.password,
    };

    return executeInventoryTransaction(requestParams, itemSlots);
  }

  function onLoad(e) {
    userVars = unsafeWindow.userVars;
    globalData = unsafeWindow.globalData;

    if (!userVars.DFSTATS_df_backpack) return;

    const invController = document.getElementById("invController");
    invController.removeEventListener("mousedown", unsafeWindow.dragStart);
    invController.removeEventListener("touchstart", unsafeWindow.dragStart);
    document.addEventListener("mousedown", dragStart);
    document.addEventListener("touchstart", dragStart);

    const inventoryHolder = unsafeWindow.inventoryHolder;
    inventoryHolder.style.overflow = "visible";
    const overflowContainer =
      inventoryHolder.parentElement.parentElement.parentElement.parentElement;
    overflowContainer.style.overflow = "visible";

    unsafeWindow.inventoryHolder.removeEventListener(
      "mousemove",
      unsafeWindow.drag,
    );
    unsafeWindow.inventoryHolder.removeEventListener(
      "touchmove",
      unsafeWindow.drag,
    );
    document.addEventListener("mousemove", unsafeWindow.drag);
    document.addEventListener("touchmove", unsafeWindow.drag);

    const backpackMenu = createBackpackUI();

    invController.appendChild(backpackMenu);

    let iframe = document.createElement("iframe");
    iframe.src =
      "https://fairview.deadfrontier.com/onlinezombiemmo/index.php?page=25";
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    iframe.onload = function () {
      unsafeWindow.updateIntoArr(iframe.contentWindow.userVars, userVars);
      unsafeWindow.populateBackpack();

      backpackMenu.classList.remove("arys-hidden");
      backpackMenu.addEventListener("mousedown", dragElementStart);
      backpackMenu.addEventListener("touchstart", dragElementStart);

      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => repositionDragElement(), 300);
      });
      iframe.remove();
    };
  }

  const pollUpdateInventory = setInterval(() => {
    if (typeof unsafeWindow.updateInventory === "function") {
      clearInterval(pollUpdateInventory);
      const originalUpdateInventory = unsafeWindow.updateInventory;
      unsafeWindow.updateInventory = function (...args) {
        if (!updateInventory(...args)) {
          originalUpdateInventory(...args);
        }
      };
    }
  }, 50);

  const pollDragEnd = setInterval(() => {
    if (typeof unsafeWindow.dragEnd === "function") {
      clearInterval(pollDragEnd);
      const originalDragEnd = unsafeWindow.dragEnd;

      unsafeWindow.dragEnd = function (...args) {
        if (currentItemToken) {
          restoreStyles({
            el: currentItemToken.el,
            position: currentItemToken.position,
            left: "0px",
            top: "0px",
          });
        }

        if (replaceeToken) {
          restoreStyles({
            el: replaceeToken.el,
            position: replaceeToken.position,
            left: "0px",
            top: "0px",
          });
        }

        originalDragEnd(...args);

        dragEnd(...args);
      };
    }
  }, 1);

  const pollDrag = setInterval(() => {
    if (typeof unsafeWindow.drag === "function") {
      clearInterval(pollDrag);
      const originalDrag = unsafeWindow.drag;

      unsafeWindow.drag = function (...args) {
        const oldInventoryHolder = unsafeWindow.inventoryHolder;
        unsafeWindow.inventoryHolder = document.body;

        if (replaceeToken) {
          restoreStyles({
            el: replaceeToken.el,
            position: replaceeToken.position,
            left: "0px",
            top: "0px",
          });
        }
        if (currentItemToken) {
          restoreStyles({
            el: currentItemToken.el,
            position: currentItemToken.position,
            left: "0px",
            top: "0px",
          });
        }

        replaceeToken = null;
        currentItemToken = null;

        originalDrag(...args);

        if (unsafeWindow.fakeGrabbedItem?.style.visibility === "visible") {
          unsafeWindow.fakeGrabbedItem.style.position = "fixed";

          const itemRect = unsafeWindow.fakeGrabbedItem.getBoundingClientRect();

          unsafeWindow.setTranslate(
            args[0].clientX - itemRect.width / 2,
            args[0].clientY - itemRect.height / 2,
            unsafeWindow.fakeGrabbedItem,
          );
        }

        if (unsafeWindow.currentItem) {
          const afterCurrentItemSnapshot = snapshotStyles(
            unsafeWindow.currentItem,
          );
          const rect = unsafeWindow.currentItem.getBoundingClientRect();
          applyFixed(unsafeWindow.currentItem, rect.left, rect.top);
          currentItemToken = afterCurrentItemSnapshot;
        }

        if (unsafeWindow.replacee) {
          const afterReplaceeSnapshot = snapshotStyles(unsafeWindow.replacee);
          const rect = unsafeWindow.replacee.getBoundingClientRect();
          applyFixed(unsafeWindow.replacee, rect.left, rect.top);
          replaceeToken = afterReplaceeSnapshot;
        }

        unsafeWindow.inventoryHolder = oldInventoryHolder;
      };
    }
  }, 1);

  window.addEventListener("load", onLoad);
})();
