import { soccerTranslation } from '../../utils/sports/soccer'
import { helpers } from '../../utils/sports/soccer'
import {
    getTournamentStandings,
    getTournamentResults,
    TournamentStandingsPayload,
    TournamentResultsPayload
} from '../../api/soccer'
import { Mappings } from '../../utils/sports/reader'
import { i18nFactory } from '../../factories'

async function handleLeagueStandings(mappings: Mappings, tournamentStandings: TournamentStandingsPayload, tournamentResults: TournamentResultsPayload): Promise<string> {
    const i18n = i18nFactory.get()

    let speech: string = ''

    if (mappings.teams.length > 0) {
        const inTournamentResults = tournamentResults.results.filter(
            r => r.sport_event.competitors.filter(c => c.id === mappings.teams[0].id).length === 1
        )

        if (inTournamentResults.length === 0) {
            speech += i18n('sports.soccer.dialog.teamDoesntParticipateInTournament', {
                team: mappings.teams[0].name,
                tournament: mappings.tournament.name
            })
            speech += ' '
        } else {
            return soccerTranslation.teamStandingToSpeech(tournamentStandings, tournamentResults, mappings.teams[0].id)
        }
    }

    speech += soccerTranslation.tournamentStandingsToSpeech(tournamentStandings)

    return speech
}

async function handleCupStandings(mappings: Mappings, tournamentStandings: TournamentStandingsPayload, tournamentResults: TournamentResultsPayload): Promise<string> {
    const i18n = i18nFactory.get()

    let speech: string = ''

    if (mappings.teams.length > 0) {
        const inTournamentResults = tournamentResults.results.filter(
            r => r.sport_event.competitors.filter(c => c.id === mappings.teams[0].id).length === 1
        )

        if (inTournamentResults.length === 0) {
            speech += i18n('sports.soccer.dialog.teamDoesntParticipateInTournament', {
                team: mappings.teams[0].name,
                tournament: mappings.tournament.name
            })
            speech += ' '
        } else {
            if (helpers.finalPhasesStarted(tournamentResults)) {
                return 'final phases started, team'
            } else {
                return soccerTranslation.teamStandingToSpeech(tournamentStandings, tournamentResults, mappings.teams[0].id)
            }
        }
    }

    if (helpers.finalPhasesStarted(tournamentResults)) {
        speech += 'final phases started, tournament'
    } else {
        speech += soccerTranslation.tournamentStandingsToSpeech(tournamentStandings)
    }

    return speech
}

export const soccerTournamentStanding = async function(mappings: Mappings): Promise<string> {
    let speech: string = ''

    const tournamentStandings = await getTournamentStandings(mappings.tournament.id)
    //TODO: fix QPS limit
    await new Promise(resolve => setTimeout(resolve, 1000))
    const tournamentResults = await getTournamentResults(mappings.tournament.id)

    if (helpers.isLeague(tournamentResults)) {
        speech += await handleLeagueStandings(mappings, tournamentStandings, tournamentResults)
    } else {
        speech += await handleCupStandings(mappings, tournamentStandings, tournamentResults)
    }

    return speech
}
