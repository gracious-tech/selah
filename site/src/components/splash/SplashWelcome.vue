
<template lang='pug'>

app-content.page(class='pa-3 text-center')

    app-brand.brand(class='large py-5')

    h2 lets you

    v-list(class='text-left' light)
        v-list-item
            v-list-item-icon
                app-svg(name='icon_live_tv')
            v-list-item-content
                v-list-item-title Watch videos at the same time

    h2 so you can

    v-list(class='text-left' light)
        v-list-item
            v-list-item-icon
                app-svg(name='icon_record_voice_over')
            v-list-item-content
                v-list-item-title Sing together unmuted
        v-list-item
            v-list-item-icon
                app-svg(name='icon_network_check')
            v-list-item-content
                v-list-item-title With delays reduced by 50%

    v-alert(v-if='prerelease === "test"' color='error' class='body-2 text-left')
        template(#prepend)
            app-svg(name='icon_warning' class='mr-3')
        | This version is for testing new features only and may not work correctly.
        | Use the <a :href='url'>main app</a> for reliable performance.
    v-alert(v-else-if='prerelease === "beta"' color='accent' class='body-2 text-left')
        template(#prepend)
            app-svg(name='icon_info' class='mr-3')
        | This is a beta version. It's ready to use but may still have some issues.
        | If you identify any, please let us know.

    p(class='mt-6')
        v-btn(@click='done' light) Continue

</template>


<script lang='ts'>


import {Component, Vue} from 'vue-property-decorator'

import app_config from '@/app_config.json'
import {prerelease} from '@/services/misc'
import AppBrand from '@/components/reuseable/AppBrand.vue'


@Component({components: {AppBrand}})
export default class extends Vue {
    prerelease = prerelease

    get url(){
        return `https://${app_config.domain}`
    }

    done(){
        this.$store.commit('dict_set', ['show_splash_welcome', false])
    }
}


</script>


<style lang='sass' scoped>

.page
    background-color: $primary
    color: $on_primary

.brand
    justify-content: center

h2
    font-size: 24px
    font-weight: 500

.v-list
    display: inline-block // So can center whole list
    width: 100%
    max-width: 400px

    .v-list-item
        padding-left: 16px * 2
        padding-right: 0

    .v-list-item__icon svg
        // Override default icon size (applied as inline style)
        width: 32px !important
        height: 32px !important

    .v-list-item__title
        white-space: normal  // Allow wrapping

.v-alert svg
    min-width: 24px


</style>
