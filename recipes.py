def wrap_prompt(user_input: str, recipe_type: str) -> str:
    """
    Wraps user input in a specific prompt engineering framework.
    
    Args:
        user_input: The core task or query from the user.
        recipe_type: The framework to apply ('Persona', 'Chain of Thought', 'Few-Shot', 'Step-by-Step').
        
    Returns:
        The wrapped prompt string.
    """
    recipes = {
        "Persona": f"Act as an expert [Role]. Your task is to: {user_input}\n\nPlease provide a professional and detailed response.",
        
        "Chain of Thought": f"Please solve the following task by thinking step-by-step. \n\nTask: {user_input}\n\nLet's think through this logically:",
        
        "Few-Shot": (
            "Here are a few examples of how to perform this task:\n"
            "Example 1: [Input] -> [Output]\n"
            "Example 2: [Input] -> [Output]\n\n"
            f"Now, perform the task for this input: {user_input}"
        ),
        
        "Step-by-Step": f"Break down the following task into a clear, numbered sequence of steps: {user_input}",
        
        "Context Injection": f"Context: [Insert relevant background information here]\n\nTask: {user_input}\n\nConstraint: Ensure the response aligns strictly with the provided context."
    }
    
    return recipes.get(recipe_type, user_input)

# Example Usage:
# print(wrap_prompt("Write a marketing email for a new watch.", "Persona"))
