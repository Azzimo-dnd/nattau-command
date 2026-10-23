/** UI rule: only GMs may choose to hide a roll.
 * In an unpublished scene all GM throws remain private even if the switch
 * was left enabled from an earlier scene.
 */
export function shouldPublishVttDiceRoll(isDm:boolean,sceneShared:boolean,gmShareEnabled:boolean){
 return Boolean(sceneShared && (!isDm || gmShareEnabled));
}
