function getActualSlotId(slotNumber, inventoryType)
{
    if (inventoryType === "storage")
    {
        slotNumber += 40;
    }
    else if (inventoryType === "implants")
    {
        slotNumber += 1000;
    }
    else if (inventoryType === "backpackdisplay")
    {
        slotNumber += 1050;
    }

    return slotNumber;
}

const internalTransactionHandler = {
    handleBackpackToStorageOneWay(requestParams, itemSlots)
    {
        /*
            1. Swap target item with first slot in inventory
            2. Swap target item with target slot in storage
            3. (If needed) Swap items that were from original backpack slot and first slot in inventory
        */

        unsafeWindow.playSound("swap");

        const sourceItemType = itemSlots[0][1];
        const sourceInvType = itemSlots[0][2];
        const sourceSlotId = getActualSlotId(itemSlots[0][0], sourceInvType);

        const destItemType = itemSlots[1][1];
        const destInvType = itemSlots[1][2];
        const destSlotId = getActualSlotId(itemSlots[1][0], destInvType);

        const invStepSlotElement = document.querySelector("#inventory > tr > td.validSlot");
        const invStepSlotId = parseInt(invStepSlotElement.dataset.slot);
        const invStepItemType = invStepSlotElement.children.length > 0 ? invStepSlotElement.firstElementChild.dataset.type : "";

        // Backpack <-> Inventory
        requestParams.action = "backpack";
        requestParams.expected_itemtype = sourceItemType;
        requestParams.itemnum = sourceSlotId;
        requestParams.expected_itemtype2 = invStepItemType;
        requestParams.itemnum2 = invStepSlotId;

        makeRequest("hotrods/backpack", requestParams, function (data)
        {
            unsafeWindow.updateIntoArr(unsafeWindow.flshToArr(data, "DFSTATS_"), unsafeWindow.userVars);

            // Now 'sourceItemType' is at 'invStepSlotId' and 'invStepItemType' is at 'sourceSlotId'
            // Inventory <-> Storage
            requestParams.action = "store";
            requestParams.expected_itemtype = sourceItemType;
            requestParams.itemnum = invStepSlotId;
            requestParams.expected_itemtype2 = destItemType;
            requestParams.itemnum2 = destSlotId;

            makeRequest("inventory_new", requestParams, function (data)
            {
                // Now 'sourceItemType' is at 'destSlotId' and 'destItemType' is at 'invStepSlotId'
                // If the inventory swap or destination swap don't have any items, we don't need to make another request
                if (!invStepItemType && !destItemType)
                {
                    reloadStorage(data)
                    return;
                }

                unsafeWindow.updateIntoArr(unsafeWindow.flshToArr(data, "DFSTATS_"), unsafeWindow.userVars);

                // Inventory <-> Backpack
                requestParams.action = "backpack";
                if (!invStepItemType && destItemType)
                {
                    requestParams.expected_itemtype = destItemType;
                    requestParams.itemnum = invStepSlotId;
                    requestParams.expected_itemtype2 = invStepItemType;
                    requestParams.itemnum2 = sourceSlotId;
                }
                else
                {
                    requestParams.expected_itemtype = invStepItemType;
                    requestParams.itemnum = sourceSlotId;
                    requestParams.expected_itemtype2 = destItemType;
                    requestParams.itemnum2 = invStepSlotId;
                }

                makeRequest("hotrods/backpack", requestParams, reloadStorage);
            });
        });

        return true;
    },
    handleStorageToBackpackOneWay(requestParams, itemSlots)
    {
        unsafeWindow.playSound("swap");

        const sourceItemType = itemSlots[0][1];
        const sourceInvType = itemSlots[0][2];
        const sourceSlotId = getActualSlotId(itemSlots[0][0], sourceInvType);

        const destItemType = itemSlots[1][1];
        const destInvType = itemSlots[1][2];
        const destSlotId = getActualSlotId(itemSlots[1][0], destInvType);

        const invStepSlotElement = document.querySelector("#inventory > tr > td.validSlot");
        const invStepSlotId = parseInt(invStepSlotElement.dataset.slot);
        const invStepItemType = invStepSlotElement.children.length > 0 ? invStepSlotElement.firstElementChild.dataset.type : "";

        // Storage <-> Inventory
        requestParams.action = "take";
        requestParams.expected_itemtype = sourceItemType;
        requestParams.itemnum = sourceSlotId;
        requestParams.expected_itemtype2 = invStepItemType;
        requestParams.itemnum2 = invStepSlotId;

        makeRequest("inventory_new", requestParams, function (data)
        {
            unsafeWindow.updateIntoArr(unsafeWindow.flshToArr(data, "DFSTATS_"), unsafeWindow.userVars);

            // Now 'sourceItemType' is at 'invStepSlotId' and 'invStepItemType' is at 'sourceSlotId'
            // Inventory <-> Backpack
            requestParams.action = "backpack";
            requestParams.expected_itemtype = sourceItemType;
            requestParams.itemnum = invStepSlotId;
            requestParams.expected_itemtype2 = destItemType;
            requestParams.itemnum2 = destSlotId;

            makeRequest("hotrods/backpack", requestParams, function (data)
            {
                // Now 'sourceItemType' is at 'destSlotId' and 'destItemType' is at 'invStepSlotId'
                // If the inventory swap or destination swap don't have any items, we don't need to make another request
                if (!invStepItemType && !destItemType)
                {
                    reloadStorage(data);
                    return;
                }

                unsafeWindow.updateIntoArr(unsafeWindow.flshToArr(data, "DFSTATS_"), unsafeWindow.userVars);

                // Inventory <-> Storage
                if (!invStepItemType && destItemType)
                {
                    requestParams.action = "store";
                    requestParams.expected_itemtype = destItemType;
                    requestParams.itemnum = invStepSlotId;
                    requestParams.expected_itemtype2 = invStepItemType;
                    requestParams.itemnum2 = sourceSlotId;
                }
                else
                {
                    requestParams.action = "take";
                    requestParams.expected_itemtype = invStepItemType;
                    requestParams.itemnum = sourceSlotId;
                    requestParams.expected_itemtype2 = destItemType;
                    requestParams.itemnum2 = invStepSlotId;
                }

                makeRequest("inventory_new", requestParams, reloadStorage);
            });
        });

        return true;
    },
    handleBackpackToInventoryInStorage(requestParams, itemSlots)
    {
        unsafeWindow.playSound("swap");
        requestParams.action = "backpack";
        makeRequest("hotrods/backpack", requestParams, reloadStorage);

        return true;
    }
};

const transactionRules = [
    {
        name: "Backpack -> Storage (One-Way)",
        condition: (itemSlots) => {
            const sourceItemType = itemSlots[0][1];
            const destItemType = itemSlots[1][1];
            return sourceItemType === "backpackdisplay" && destItemType === "storage";
        },
        onConditionSuccess: internalTransactionHandler.handleBackpackToStorageOneWay
    },
    {
        name: "Storage -> Backpack (One-Way)",
        condition: (itemSlots) => {
            const sourceItemType = itemSlots[0][1];
            const destItemType = itemSlots[1][1];
            return sourceItemType === "storage" && destItemType === "backpackdisplay";
        },
        onConditionSuccess: internalTransactionHandler.handleStorageToBackpackOneWay
    },
    {
        name: "Backpack <-> Inventory (Storage page)",
        condition: (itemSlots) => {
            const sourceItemType = itemSlots[0][1];
            const destItemType = itemSlots[1][1];
            return document.getElementById("storage") && (sourceItemType === "backpackdisplay" || destItemType === "backpackdisplay");
        },
        onConditionSuccess: internalTransactionHandler.handleBackpackToInventoryInStorage
    }
];

window.InventoryTransactionHandler = {
    executeTransaction(requestParams, itemSlots)
    {
        const matchedRule = transactionRules.find(rule => rule.condition(itemSlots));
        let success = matchedRule?.onConditionSuccess(requestParams, itemSlots) ?? false;
        return success;
    },
    reloadStorage(data)
    {
        unsafeWindow.reloadStorageData(data);
        unsafeWindow.populateBackpack();
    }
};