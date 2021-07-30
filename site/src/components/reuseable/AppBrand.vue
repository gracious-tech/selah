
<template lang='pug'>

h1.brand
    app-svg.brand-logo(name='logo_app' :fill='false')
    div.words
        span.brand-a {{ short_name }}
        span.brand-b(class='ml-1') .cloud

</template>


<script lang='ts'>

import {Component, Vue} from 'vue-property-decorator'

import app_config from '@/app_config.json'


@Component({})
export default class extends Vue {
    short_name = app_config.short_name
}

</script>


<style lang='sass' scoped>

.brand
    text-overflow: clip  // Clip if not enough space, don't ... it
    font-size: 22px
    font-weight: 500
    display: flex

    .brand-logo
        // NOTE min-width required to stop logo shrinking when page too narrow
        min-height: 40px
        min-width: 40px
        max-height: 40px
        max-width: 40px
        margin-right: 4px

    .words
        padding-top: 5px

    .brand-a
        color: $accent

    .brand-b
        color: white

    &.large
        // 50% increase to all
        font-size: 33px

        .brand-logo
            min-height: 60px
            min-width: 60px

        .words
            padding-top: 8px

</style>
