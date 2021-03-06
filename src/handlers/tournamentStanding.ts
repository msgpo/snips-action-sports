import { slot, tts } from '../utils'
import { Handler, logger, i18n, config } from 'snips-toolkit'
import commonHandler, { KnownSlots } from './common'
import { soccerTournamentStanding } from './soccer'
import { nbaTournamentStanding } from './nba'
import { INTENT_FILTER_PROBABILITY_THRESHOLD } from '../constants'
import { reader, Mappings } from '../utils/sports'
import { Hermes } from 'hermes-javascript'

export const tournamentStandingHandler: Handler = async function (msg, flow, hermes: Hermes, knownSlots: KnownSlots = { depth: 2 }) {
    logger.info('TournamentStanding')

    const {
        teams,
        tournament
    } = await commonHandler(msg, knownSlots)

    // for now, the tournament is required
    if (slot.missing(tournament)) {
        if (knownSlots.depth === 0) {
            throw new Error('slotsNotRecognized')
        }

        /*
        flow.notRecognized((msg, flow) => {
            knownSlots.depth -= 1
            return tournamentStandingHandler(msg, flow, knownSlots)
        })
        */

        flow.continue(`${ config.get().assistantPrefix }:ElicitTournament`, (msg, flow) => {
            if (msg.intent.confidenceScore < INTENT_FILTER_PROBABILITY_THRESHOLD) {
                throw new Error('intentNotRecognized')
            }

            return tournamentStandingHandler(msg, flow, hermes, {
                teams,
                depth: knownSlots.depth - 1
            })
        })

        flow.continue(`${ config.get().assistantPrefix }:Cancel`, (_, flow) => {
            flow.end()
        })
        flow.continue(`${ config.get().assistantPrefix }:StopSilence`, (_, flow) => {
            flow.end()
        })

        return i18n.translate('sports.dialog.noTournament')
    }

    const now: number = Date.now()
    const mappings: Mappings = reader(teams, tournament)

    if (!mappings.homogeneousness.homogeneous) {
        flow.end()
        return mappings.homogeneousness.message
    }

    try {
        let speech: string = ''

        const sportId = (mappings.tournament)
            ? mappings.tournament.sport.id
            : mappings.teams[0].sport.id

        switch (sportId) {
            // soccer
            case 'sr:sport:1': {
                speech = await soccerTournamentStanding(mappings)
                break
            }
            // basketball
            case 'sport:1': {
                speech = await nbaTournamentStanding(mappings)
                break
            }
        }

        logger.info(speech)

        flow.end()
        if (Date.now() - now < 4000) {
            return speech
        } else {
            tts.say(hermes, speech)
        }
    } catch (error) {
        logger.error(error)
        throw new Error('APIResponse')
    }
}
