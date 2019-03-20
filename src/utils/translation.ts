import { i18nFactory } from '../factories/i18nFactory'
import { beautify } from './beautify'
import {
    Result,
    Competitor,
    TournamentStandingsPayload,
    TeamStanding,
    Group,
    TournamentResultsPayload,
    TournamentSchedulePayload,
    TeamSchedulePayload
} from '../api'
import { helpers } from '../utils/sports'
import { time } from './time'
import { logger } from './logger';

function buildFinalPhasesTts(results: Result[], teamId: string): string {
    const i18n = i18nFactory.get()
    const result = results[results.length - 1]

    let tts = ''

    const team1 = result.sport_event.competitors.find(competitor => competitor.id === teamId)
    const team2 = result.sport_event.competitors.find(competitor => competitor.id !== teamId)

    const team1Score = result.sport_event_status[team1.qualifier + '_score']
    const team2Score = result.sport_event_status[team2.qualifier + '_score']

    if (result.sport_event_status.match_status === 'ended') {
        const key = (team1Score === team2Score)
            ? 'tiedFinalPhases'
            : ((team1Score < team2Score) ? 'lostFinalPhases' : 'wonFinalPhases')

        tts += i18n('sports.teamStanding.' + key, {
            team_2: team2.name,
            team_1_score: team1Score,
            team_2_score: team2Score,
            round: i18n('sports.finalPhases.roundOf16')
        })
    }

    return tts
}

export const translation = {
    // Outputs an error message based on the error object, or a default message if not found.
    errorMessage: async (error: Error): Promise<string> => {
        let i18n = i18nFactory.get()

        if(!i18n) {
            await i18nFactory.init()
            i18n = i18nFactory.get()
        }

        if(i18n) {
            return i18n([`error.${error.message}`, 'error.unspecific'])
        } else {
            return 'Oops, something went wrong.'
        }
    },

    // Takes an array from the i18n and returns a random item.
    randomTranslation (key: string | string[], opts: {[key: string]: any}): string {
        const i18n = i18nFactory.get()

        const possibleValues = i18n(key, { returnObjects: true, ...opts })
        if (typeof possibleValues === 'string')
            return possibleValues

        const randomIndex = Math.floor(Math.random() * possibleValues.length)
        return possibleValues[randomIndex]
    },

    tournamentStandingsToSpeech(standings: TournamentStandingsPayload): string {
        let speech: string = ''

        // regular season
        if (helpers.isRegularSeason(standings)) {
            const teamStandings: TeamStanding[] = standings.standings[0].groups[0].team_standings

            for (let i = 0; i < Math.min(teamStandings.length, 5); i++) {
                speech += translation.randomTranslation('sports.tournamentStandings.standings.' + (i + 1), {
                    team: teamStandings[i].team.name,
                    points: teamStandings[i].points
                })
                speech += ' '
            }
        }
        // group phases
        else {
            const groups: Group[] = standings.standings[0].groups

            for (let group of groups) {
                const teamStandings: TeamStanding[] = group.team_standings

                speech += translation.randomTranslation('sports.tournamentStandings.standingsInGroups', {
                    team: teamStandings[0].team.name,
                    group: group.name,
                    points: teamStandings[0].points
                })
                speech += ' '
            }
        }

        return speech
    },

    teamStandingToSpeech(standings: TournamentStandingsPayload, results: TournamentResultsPayload, teamId: string): string {
        const i18n = i18nFactory.get()

        let speech: string = ''

        const group = standings.standings[0].groups.find(
            g => g.team_standings.some(team => team.team.id === teamId)
        )
        const teamStandings = group.team_standings.find(team => team.team.id === teamId)

        // regular season
        if (helpers.isRegularSeason(standings)) {
            speech += i18n('sports.tournamentStandings.rank', {
                team: teamStandings.team.name,
                tournament: standings.tournament.name,
                rank: teamStandings.rank
            })
        }
        // group phases
        else {
            speech += i18n('sports.tournamentStandings.rankInGroup', {
                team: teamStandings.team.name,
                tournament: standings.tournament.name,
                rank: teamStandings.rank,
                group: group.name
            })

            speech += ' '
            speech += buildFinalPhasesTts(results.results.filter(
                r => r.sport_event.competitors.filter(c => c.id === teamId).length === 1
            ), teamId)
        }

        return speech
    },

    teamResultToSpeech (result: Result, firstTeamId: string = undefined, longTts = true): string {
        const i18n = i18nFactory.get()

        let speech = '', team1: Competitor, team2: Competitor

        if (firstTeamId) {
            team1 = result.sport_event.competitors.find(competitor => competitor.id === firstTeamId)
            team2 = result.sport_event.competitors.find(competitor => competitor.id !== team1.id)
        } else {
            team1 = result.sport_event.competitors[0]
            team2 = result.sport_event.competitors[1]
        }

        const team1Score = result.sport_event_status[team1.qualifier + '_score']
        const team2Score = result.sport_event_status[team2.qualifier + '_score']

        const key = (team1Score === team2Score)
            ? 'teamTied'
            : ((team1Score < team2Score) ? 'teamLost' : 'teamWon')

        speech += i18n((longTts ? 'sports.matchResults.' : 'sports.tournamentResults.') + key, {
            tournament: result.sport_event.tournament.name,
            team_1: team1.name,
            team_2: team2.name,
            date: beautify.date(new Date(result.sport_event.scheduled)),
            team_1_score: team1Score,
            team_2_score: team2Score
        })

        return speech
    },

    tournamentResultsToSpeech (tournamentResults: TournamentResultsPayload): string {
        const i18n = i18nFactory.get()

        let results = tournamentResults.results
        let speech = ''

        // regular season
        if (helpers.isRegularSeason(tournamentResults)) {
            const round = results[results.length - 1].sport_event.tournament_round.number

            speech += i18n('sports.tournamentResults.introductionRound', {
                tournament: results[0].sport_event.tournament.name,
                day: round
            })
            speech += ' '

            results = results.filter(result => result.sport_event.tournament_round.number === round)
        }
        // group phases
        else {
            const day = new Date(results[results.length - 1].sport_event.scheduled)

            speech += i18n('sports.tournamentResults.introduction', {
                tournament: results[0].sport_event.tournament.name
            })
            speech += ' '

            // printing games played the same day
            results = results.filter(result => time.areSameDays(day, new Date(result.sport_event.scheduled)))
        }

        for (let result of results) {
            speech += translation.teamResultToSpeech(result, undefined, false)
            speech += ' '
        }

        return speech
    },

    tournamentScheduleToSpeech(tournamentSchedule: TournamentSchedulePayload): string {
        const i18n = i18nFactory.get()

        let tts = ''

        const nextEvents = tournamentSchedule.sport_events.filter(e => new Date(e.scheduled) > new Date())
        
        if (nextEvents.length === 0) {
            tts += i18n('sports.dialog.tournamentOver')
        } else {
            const nextDate = new Date(nextEvents[0].scheduled)
            const events = nextEvents.filter(e => time.areSameDays(new Date(e.scheduled), nextDate))

            tts += i18n('sports.tournamentSchedule.introduction', {
                tournament: tournamentSchedule.tournament.name,
                date: beautify.date(new Date(events[0].scheduled))
            })
            tts += ' '

            for (let event of events) {
                tts += translation.randomTranslation('sports.tournamentSchedule.match', {
                    team_1: event.competitors[0].name,
                    team_2: event.competitors[1].name,
                    time: beautify.time(new Date(event.scheduled))
                })
                tts += ' '
            }
        }

        return tts
    },

    teamScheduleToSpeech(teamSchedule: TeamSchedulePayload): string {
        const i18n = i18nFactory.get()

        let tts = ''

        if (teamSchedule.schedule.length === 0) {
            tts += i18n('sports.dialog.noScheduledGames')
        } else {
            const scheduledEvent = teamSchedule.schedule[0]

            tts += i18n('sports.teamSchedule.nextMatch', {
                team_1: scheduledEvent.competitors[0].name,
                team_2: scheduledEvent.competitors[1].name,
                tournament: scheduledEvent.tournament.name,
                date: beautify.date(new Date(scheduledEvent.scheduled)),
                time: beautify.time(new Date(scheduledEvent.scheduled))
            })
        }

        return tts
    }
}
