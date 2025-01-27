# OPlanner

OPlanner is a semester planner application that helps students organize their courses and semesters efficiently.

## Features

- Add, rename, and delete courses.
- Expand and collapse years and semesters.
- Preserve the expanded state of years and semesters.
- Context menu for course actions.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/yourusername/OPlanner.git
    ```
2. Navigate to the project directory:
    ```bash
    cd OPlanner/semester-planner
    ```
3. Install the dependencies:
    ```bash
    npm install
    ```

## Usage

1. Start the development server:
    ```bash
    npm start
    ```
2. Open your browser and navigate to `http://localhost:3000`.

## Components

### Sidebar

The `Sidebar` component is responsible for displaying the list of years, semesters, and courses. It allows users to add, rename, and delete courses.

#### Props

- `onCourseOrSemesterSelect`: Function to handle the selection of a course or semester.

#### State

- `years`: Array of year data.
- `isModalOpen`: Boolean to control the visibility of the add course modal.
- `modalData`: Data for the add course modal.
- `newCourseName`: Name of the new course to be added.
- `contextMenu`: Data for the context menu.
- `renameModal`: Data for the rename course modal.
- `renameCourseName`: Name of the course to be renamed.
- `isAddingYear`: Boolean to control the state of adding a new year.
- `isLoading`: Boolean to control the loading state for fetching years and semesters.
- `isLoadingAction`: Boolean to control the loading state for actions like adding, renaming, and deleting courses.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
