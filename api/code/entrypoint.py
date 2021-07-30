
# WARN No imports allowed here to keep sync responses as fast as possible


def reply_to_sync_request(event):
    """Reply to a sync request by adding own timestamp"""

    # Get access to sockets to send reply
    import boto3
    domain = event['requestContext']['domainName']
    stage = event['requestContext']['stage']
    sockets = boto3.client('apigatewaymanagementapi', endpoint_url=f'https://{domain}/{stage}')

    # Add this request's timestamp to existing one
    # WARN We are echoing untested user input (should be safe as only echoing to the sender)
    data = event['body'] + '\n' + str(event['requestContext']['requestTimeEpoch'])

    # Send the data back to the client (ignore if just disconnected)
    sender = event['requestContext']['connectionId']
    try:
        sockets.post_to_connection(Data=data, ConnectionId=sender)
    except sockets.exceptions.GoneException:
        pass


def handle(event, context):
    """Handle websocket AWS_PROXY integration requests

    Unlike REST etc a response cannot be sent back without manually calling `post_to_connection`
    AWS will auto-send a message for errors in the format:
        {"message": "Internal server error", "connectionId": "...", "requestId": "..."}
    AWS websocket docs poor, but similar to REST docs:
        https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
    Any statusCode returned will not result in an error response or log by AWS
        Resulting in no response sent at all (as is the case for websockets)
        .:. Leverage AWS' built-in error response by not catching server errors (only client errors)

    """

    # Directly respond to time syncs to make response as fast as possible
    body = event.get('body')
    if body and body[0] != '{':
        # Body is present and not JSON so assuming it is a sync message
        reply_to_sync_request(event)
        return

    # Handle regular message
    from handlers import WebsocketHandlers
    handlers = WebsocketHandlers(event, context)
    handlers.process_input()
    handlers.handle()


def enter(event, context):
    """Wrap all handling to catch any errors and report via SNS"""
    try:
        handle(event, context)
        return {'statusCode': 200}
    except Exception as exc:
        # Send traceback info to errors SNS topic
        import os
        import boto3
        import traceback
        stack = os.environ['STACK']
        boto3.client('sns').publish(
            TopicArn=os.environ['TOPIC_ERRORS'],
            Subject=f"{stack} API Error",
            Message=traceback.format_exc(),
        )

        # If was a client error, don't fail as not a server error
        # NOTE But still probs issue with own code, so still notified above
        from handlers import WebsocketHandlers
        if isinstance(exc, WebsocketHandlers.ClientError):
            return {'statusCode': 200}

        # Reraise exc so also exists in normal lambda logs and client knows something went wrong
        raise
