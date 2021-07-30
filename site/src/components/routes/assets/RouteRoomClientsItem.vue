
<template lang='pug'>

v-list-item
    v-list-item-icon(:title='sync_title')
        app-svg.sync_status(name='icon_schedule' :class='sync_status')
    v-list-item-content
        v-list-item-title
            div {{ name }}
            div.notes {{ client.admin ? "Admin" : "" }}

</template>


<script lang='ts'>

import {Component, Vue, Prop} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    @Prop() client

    get name(){
        // Return name, or custom if self
        if (this.client.socket === null){  // self (see RouteRoomClients)
            return this.$store.state.name || "You"  // Will be at top of list so no chars needed
        }
        return this.$store.getters.client_names[this.client.socket]
    }

    get sync_status(){
        // Return a code for the sync status to help communicate it to the user
        if (this.$store.getters.paused){
            return null  // Not playing so N/A
        }
        if (this.client.synced === null){
            return 'bad'  // Trying to sync but not acceptable yet
        }
        return Math.abs(this.client.synced) < 100 ? 'good' : 'good_enough'  // Assuming 200 max
    }

    get sync_title(){
        // Return title text for the video sync status
        const titles = {
            null: "Video not playing",
            bad: "Video out of sync",
            good: "Video in sync",
            good_enough: "Video mostly in sync",
        }
        return titles[this.sync_status]
    }

}

</script>


<style lang='sass' scoped>


.sync_status

    &.good
        color: green

    &.good_enough
        color: orange

    &.bad
        color: red


.v-list-item__title
    display: flex
    justify-content: space-between
    align-items: center

    .notes
        opacity: 0.7
        font-size: 0.8em

</style>
