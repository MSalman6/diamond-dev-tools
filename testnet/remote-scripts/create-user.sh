#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <username>"
    exit 1
fi

USERNAME="$1"  # Get the username from the first argument

AUTHORIZED_KEYS_SOURCE="/users/dmdnode/.ssh/authorized_keys"
USER_HOME="/home/$USERNAME"

# Check if the user exists
if id "$USERNAME" &>/dev/null; then
    echo "User $USERNAME already exists."
else
    # Create the user
    useradd -m "$USERNAME"
    echo "User $USERNAME created."

    # Copy authorized_keys if it exists
    if [ -f "$AUTHORIZED_KEYS_SOURCE" ]; then
        mkdir -p "$USER_HOME/.ssh"
        chmod 700 "$USER_HOME/.ssh"
        cp "$AUTHORIZED_KEYS_SOURCE" "$USER_HOME/.ssh/authorized_keys"
        chown -R "$USERNAME:$USERNAME" "$USER_HOME/.ssh"
        chmod 600 "$USER_HOME/.ssh/authorized_keys"
        echo "Authorized keys copied for $USERNAME."
    else
        echo "Source authorized_keys file does not exist."
    fi
fi
