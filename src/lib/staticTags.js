// Static interest tags for user matching
export const interestCategories = [
    {
        id: 'tech',
        name: 'Technology',
        options: [
            { id: 'tech_programming', name: 'Programming' },
            { id: 'tech_ai', name: 'Artificial Intelligence' },
            { id: 'tech_gaming', name: 'Gaming' },
            { id: 'tech_cybersecurity', name: 'Cybersecurity' },
            { id: 'tech_other', name: 'Other Tech' }
        ]
    },
    {
        id: 'sports',
        name: 'Sports',
        options: [
            { id: 'sports_football', name: 'Football/Soccer' },
            { id: 'sports_basketball', name: 'Basketball' },
            { id: 'sports_running', name: 'Running' },
            { id: 'sports_swimming', name: 'Swimming' },
            { id: 'sports_other', name: 'Other Sports' }
        ]
    },
    {
        id: 'hobbies',
        name: 'Hobbies',
        options: [
            { id: 'hobbies_reading', name: 'Reading' },
            { id: 'hobbies_music', name: 'Music' },
            { id: 'hobbies_cooking', name: 'Cooking' },
            { id: 'hobbies_art', name: 'Art & Crafts' },
            { id: 'hobbies_other', name: 'Other Hobbies' }
        ]
    },
    {
        id: 'education',
        name: 'Education',
        options: [
            { id: 'edu_science', name: 'Science' },
            { id: 'edu_languages', name: 'Languages' },
            { id: 'edu_history', name: 'History' },
            { id: 'edu_mathematics', name: 'Mathematics' },
            { id: 'edu_other', name: 'Other Educational Topics' }
        ]
    },
    {
        id: 'lifestyle',
        name: 'Lifestyle',
        options: [
            { id: 'lifestyle_travel', name: 'Travel' },
            { id: 'lifestyle_fitness', name: 'Fitness' },
            { id: 'lifestyle_fashion', name: 'Fashion' },
            { id: 'lifestyle_food', name: 'Food & Dining' },
            { id: 'lifestyle_other', name: 'Other Lifestyle' }
        ]
    },
    {
        id: 'age_group',
        name: 'Age Group',
        options: [
            { id: 'age_18_24', name: '18-24' },
            { id: 'age_25_34', name: '25-34' },
            { id: 'age_35_44', name: '35-44' },
            { id: 'age_45_54', name: '45-54' },
            { id: 'age_55_plus', name: '55+' }
        ]
    }
];

// Helper function to get all options as a flat array
export const getAllOptions = () => {
    return interestCategories.flatMap(category =>
        category.options.map(option => ({
            ...option,
            category: category.id,
            categoryName: category.name
        }))
    );
};

// Function to get matching score between two users based on their selected interests
export const calculateMatchScore = (userInterests1, userInterests2) => {
    const set1 = new Set(userInterests1);
    const set2 = new Set(userInterests2);

    let matchCount = 0;
    set1.forEach(interest => {
        if (set2.has(interest)) {
            matchCount++;
        }
    });

    return {
        score: matchCount,
        maxPossible: Math.max(set1.size, set2.size),
        percentage: (set1.size + set2.size > 0)
            ? (matchCount * 2 / (set1.size + set2.size) * 100)
            : 0
    };
}; 