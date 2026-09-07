# User guide

## Connect with xAI

1. Start the DSH Web profile.
2. Open **Settings → Models**.
3. Find the **xAI** provider.
4. Select **Connect with xAI**.
5. Open the HTTPS authorization page and enter the device code.
6. Return to DSH. The card changes to **Connected with xAI OAuth**.

OAuth access and refresh tokens are stored by DSH and are never displayed by
this plugin.

## Choose a Grok model

Create or open a DSH session, select the xAI provider, and choose one of the
Grok models offered by the DSH model catalog.

## Refresh status

Use **Refresh** if authentication was completed in another browser and the
card has not updated yet.

## Disconnect

Select **Disconnect** and confirm. This removes the xAI OAuth grant from this
DSH installation. It does not revoke unrelated xAI sessions.

## API key and OAuth

The DSH **Edit** action belongs to the native xAI provider and can store an API
key. A configured API key takes priority over OAuth.

If that happened accidentally:

1. return to the xAI provider card;
2. select **Restore OAuth**;
3. confirm the repair;
4. refresh the status.

The repair removes only the API-key override and preserves the OAuth grant.

## Troubleshooting

### The xAI provider is missing

Confirm that the plugin is listed in the Web profile and restart DSH. Run the
installer again if necessary; it validates the composed profile.

### OAuth is connected but requests use an API key

Use **Restore OAuth** on the xAI card. The button appears only when the plugin
detects an API-key override.

### The device code expired

Start **Connect with xAI** again to obtain a fresh code.

### A remote VM has no browser

Use an SSH tunnel as described in
[Installation](./INSTALLATION.md#headless-host-over-ssh). No browser is needed
on the VM.
