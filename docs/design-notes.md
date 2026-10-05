# Design notes

These are ideas to explore, not confirmed requirements or a commitment to implement them together. The confirmed product direction remains in [app-plan.md](app-plan.md). Keep ideas here until their behavior and priority are decided; then update the app plan and any affected implementation together.

## Data model

- Exercise: specification and description of a specific exercise
- Execution: recorded exercise
- Workout: collection of exercises
- Session: collection of executions
    - can be started based on a workout or blank (user adds exercises on-the-fly)
    - user can rearrange unfinished exercises

## User interface

- Active session 
    - session view: list of completed executions and list of uncompleted, rearrangable exercises
- Active exercise 
    - mode: weight & repitition, timer, stop watch
    - show last execution of exercise as reference 
    - go to next exercise
    - go back to session view

## Workouts

- auto-forward mode: goes to next exercise after it is finished (timer went down or user manually completes exercise)


## Exercise organization

- Add a category system for exercises. Tags may be a good fit because an exercise can belong to several categories at once.
- Example tags: `vertical push`, `compound exercise`, `hip hinge`.
- To decide later: whether tags are built in, user-defined, or both; whether they apply to reusable exercises, workout steps, or both.

## Workout types and session flow

- Explore two types of workouts:
  - A time-oriented workout, such as HIIT, where exercises advance automatically according to the timer.
  - A flexible workout for recording a gym session, where the user logs sets and controls the order of exercises.
- Possible names to consider: **Timed** and **Flexible**. These describe how the session proceeds; the labels are not settled.
- In a flexible workout, allow the user to record an exercise planned for later in the workout or substitute a different exercise. Examples: equipment is unavailable or a machine is occupied.
- To decide later: how reordering and substitutions appear in session history, and whether changes affect only the current session or also the saved workout.

## Active workout screen

- Make the active session and exercise screen fit the display without scrolling.
- In a flexible workout, show the most recent recorded result for the current exercise, including reps and weight, to help the user choose a progression target.
- In a flexible workout, provide a rest timer between sets.
- To decide later: how the no-scrolling layout adapts to small screens, landscape orientation, larger text, notes, and expanded controls; whether the rest timer starts automatically or manually.
