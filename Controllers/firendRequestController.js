const userModel = require('../Models/User_Model');
const FriendRequest = require('../Models/friendRequestModel');

// send friend request ================================

const sendFriendRequest = async (req, res) => {
    try {
        const {
            senderId,
            receiverId
        } = req.body;

        // Check if the sender and receiver exist
        const sender = await userModel.findById(senderId);
        const receiver = await userModel.findById(receiverId);

        // Check if the sender and receiver are the same user
        if (senderId === receiverId) {
            return res.status(400).json({
                status: 'failed',
                message: 'Cannot send friend request to yourself',
            });
        }

        if (!sender || !receiver) {
            return res.status(404).json({
                status: 'failed',
                message: 'Sender or receiver not found',
            });
        }

        // Check if the users are already friends
        if (sender.friends.includes(receiverId) || receiver.friends.includes(senderId)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Users are already friends',
            });
        }

        // Check if there is an existing friend request
        const existingRequest = await FriendRequest.findOne({
            sender: senderId,
            receiver: receiverId,
        });

        if (existingRequest) {
            return res.status(400).json({
                status: 'failed',
                message: 'Friend request already sent',
            });
        }

        // Create a new friend request
        const friendRequest = new FriendRequest({
            sender: senderId,
            receiver: receiverId,
        });

        await friendRequest.save();

        // Check if the sender has already received a friend request from the receiver
        const hasReceivedRequest = sender.friendRequests.some((requestId) =>
            receiver.sentFriendRequests.includes(requestId)
        );

        if (hasReceivedRequest) {
            return res.status(400).json({
                status: 'failed',
                message: 'Already received a friend request from the sender',
            });
        }

        // Update sender's and receiver's friendRequests arrays
        receiver.friendRequests.push(friendRequest._id);
        await receiver.save();

        // Update sender's sentFriendRequests array
        sender.sentFriendRequests.push(friendRequest._id);
        await sender.save();

        res.status(201).json({
            status: 'success',
            message: 'Friend request sent successfully',
            data: friendRequest,
        });
    } catch (error) {
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};

// accept friend request ==========================
const acceptFriendRequest = async (req, res) => {
    try {
        const { userId, friendRequestId } = req.body;

        // Find the user who is accepting the friend request
        const acceptingUser = await userModel.findById(userId);

        // Check if the user exists
        if (!acceptingUser) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found',
            });
        }

        // Find the friend request in the database
        const friendRequest = await FriendRequest.findById(friendRequestId);

        // Check if the friend request exists
        if (!friendRequest) {
            return res.status(404).json({
                status: 'failed',
                message: 'Friend request not found',
            });
        }

        // Check if the friend request is already accepted
        if (friendRequest.status === 'accepted') {
            return res.status(400).json({
                status: 'failed',
                message: 'Friend request already accepted',
            });
        }

        // Check if the accepting user is already a friend of the sender
        if (acceptingUser.friends.includes(friendRequest.sender)) {
            return res.status(400).json({
                status: 'failed',
                message: 'You are already friends with this user',
            });
        }

        // Update accepting user's friend list
        acceptingUser.friends.push(friendRequest.sender);

        // Remove friendRequestId from the accepting user's friendRequests array
        acceptingUser.friendRequests = acceptingUser.friendRequests.filter(
            (requestId) => requestId.toString() !== friendRequestId
        );

        // Save the changes
        await acceptingUser.save();

        // Update sender's friend list
        const senderUser = await userModel.findById(friendRequest.sender);
        senderUser.friends.push(acceptingUser._id);

        // Remove friendRequestId from the sender's friendRequests array
        senderUser.sentFriendRequests = senderUser.sentFriendRequests.filter(
            (requestId) => requestId.toString() !== friendRequestId
        );

        // Save the changes
        await senderUser.save();

        // Set the friend request status to 'accepted'
        friendRequest.status = 'accepted';
        await friendRequest.save();

        // Remove friend request from the database
        await FriendRequest.findByIdAndRemove(friendRequestId);

        res.status(200).json({
            status: 'success',
            message: 'Friend request accepted successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};


// reject friend request ================================
const rejectFriendRequest = async (req, res) => {
    try {
        const {
            userId,
            friendRequestId
        } = req.body;

        // Find the user who is rejecting the friend request
        const rejectingUser = await userModel.findById(userId);

        // Check if the user exists
        if (!rejectingUser) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found',
            });
        }

        // Find the friend request in the database
        const friendRequest = await FriendRequest.findById(friendRequestId);

        // Check if the friend request exists
        if (!friendRequest) {
            return res.status(404).json({
                status: 'failed',
                message: 'Friend request not found',
            });
        }

        // Check if the friend request is already accepted or rejected
        if (friendRequest.status === 'accepted' || friendRequest.status === 'rejected') {
            return res.status(400).json({
                status: 'failed',
                message: 'Friend request already processed',
            });
        }

        // Remove friendRequestId from the rejecting user's friendRequests array
        rejectingUser.friendRequests = rejectingUser.friendRequests.filter(
            (requestId) => requestId.toString() !== friendRequestId
        );

        // Save the changes
        await rejectingUser.save();

        // Remove friendRequestId from the sender's friendRequests array
        const senderUser = await userModel.findById(friendRequest.sender);
        senderUser.sentFriendRequests = senderUser.sentFriendRequests.filter(
            (requestId) => requestId.toString() !== friendRequestId
        );

        // Save the changes
        await senderUser.save();

        // Set the friend request status to 'rejected'
        friendRequest.status = 'rejected';
        await friendRequest.save();

        // Remove friend request from the database
        await FriendRequest.findByIdAndRemove(friendRequestId);

        res.status(200).json({
            status: 'success',
            message: 'Friend request rejected successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};

// unfriend controller ============================
const unfriend = async (req, res) => {
    try {
        const {
            userId,
            friendId
        } = req.body;

        // Find the user and friend by their IDs
        const user = await userModel.findById(userId);
        const friend = await userModel.findById(friendId);

        // Check if both users exist
        if (!user || !friend) {
            return res.status(404).json({
                status: 'failed',
                message: 'User or friend not found',
            });
        }
        if (!user.friends.includes(friendId)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Users are not friends',
            });
        }

        // Remove friendId from the user's friends array
        user.friends = user.friends.filter((friendInList) => friendInList.toString() !== friendId);

        // Remove userId from the friend's friends array
        friend.friends = friend.friends.filter((userInList) => userInList.toString() !== userId);

        // Save the changes
        await user.save();
        await friend.save();

        res.status(200).json({
            status: 'success',
            message: 'Unfriended successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};

// get all friends =================================
const getAllFriends = async (req, res) => {
    try {
        const {
            userId
        } = req.body;
        // Find the user by ID and join with friends
        const user = await userModel.findById(userId)
            .populate('friends')
            .exec();

        // Check if the user exists
        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found',
            });
        }

        const friends = (user?.friends).map((friend) => ({
            _id: friend._id,
            firstName: friend.firstName,
            lastName: friend.lastName,
            email: friend.email,
        }));

        // Check if the user has friends
        if (!user.friends) {
            return res.status(200).json({
                status: 'success',
                message: 'User has no friends',
                data: friends,
            });
        }

        res.status(200).json({
            status: 'success',
            data: friends,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};

// get all friend request ========================

const getAllFriendRequestsReceived = async (req, res) => {
    try {
        const {
            userId
        } = req.body;

        // Find the user by ID and populate the 'friendRequests' field
        const user = await userModel.findById(userId).populate('friendRequests');

        // Check if the user exists
        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found',
            });
        }

        // Extract and send the friend requests data with detailed information
        const friendRequests = user.friendRequests || [];

        res.status(200).json({
            status: 'success',
            data: friendRequests,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};

// get sent friend request ===================================

const getSentFriendRequests = async (req, res) => {
    try {
        const {
            userId
        } = req.params;

        // Find the user by ID and populate the 'sentFriendRequests' field
        const user = await userModel.findById(userId).populate('sentFriendRequests');

        // Check if the user exists
        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found',
            });
        }

        // Extract and send the sent friend requests data with detailed information
        const sentFriendRequests = user.sentFriendRequests || [];

        res.status(200).json({
            status: 'success',
            data: sentFriendRequests,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};


// cancell sent friend request ============================= 

const cancelSentFriendRequest = async (req, res) => {
    try {
        const {
            senderId,
            friendRequestId
        } = req.body;

        // Get information about the sender from the model
        const sender = await userModel.findById(senderId);

        if (!sender) {
            return res.status(404).json({
                status: 'failed',
                message: 'Sender not found',
            });
        }

        // Find and remove the friend request sent by the sender
        const friendRequest = await FriendRequest.findByIdAndRemove(friendRequestId);

        if (!friendRequest) {
            return res.status(400).json({
                status: 'failed',
                message: 'No friend request found to cancel',
            });
        }

        // Remove the friend request ID from the sender's sentFriendRequests array
        sender.sentFriendRequests = sender.sentFriendRequests.filter(id => id.toString() !== friendRequest._id.toString());

        // Get information about the receiver from the model
        const receiver = await userModel.findById(friendRequest.receiver);

        if (receiver) {
            // Remove the friend request ID from the receiver's friendRequests array
            receiver.friendRequests = receiver.friendRequests.filter(id => id.toString() !== friendRequest._id.toString());
            await receiver.save();
        }

        await sender.save();

        res.status(200).json({
            status: 'success',
            message: 'Sent friend request canceled successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'failed',
            message: error.message,
        });
    }
};


// find friends controller ==========================

const findFriends = async (req, res) => {
  try {
    const { searchQuery } = req.body;

    // Use a MongoDB query to find friends based on the search criteria
    const friends = await userModel.find({
      $or: [
        { userName: { $regex: searchQuery, $options: 'i' } }, 
        { email: { $regex: searchQuery, $options: 'i' } }, 
    ],
    });

    res.status(200).json({ success: true, data: friends });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to find friends' });
  }
};

// get mutual friends ========================================
// const getMutualFriends = async (req, res) => {
//   try {
//     const { userId1, userId2 } = req.params;

//     // Fetch user data for both users
//     const user1 = await userModel.findById(userId1);
//     const user2 = await userModel.findById(userId2);

//     if (!user1 || !user2) {
//       return res.status(404).json({ error: 'Users not found' });
//     }

//     // Find common friends by comparing friend lists
//     const mutualFriends = user1.friends.filter(friendId =>
//       user2.friends.includes(friendId)
//     );

//     res.status(200).json(mutualFriends);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Error fetching mutual friends');
//   }
// };
const getMutualFriends = async (req, res) => {
    try {
      const { userId1, userId2 } = req.params;
  
      // Fetch user data for both users
      const user1 = await userModel.findById(userId1);
      const user2 = await userModel.findById(userId2);
  
      if (!user1 || !user2) {
        return res.status(404).json({ error: 'Users not found' });
      }
  
      // Find common friends by comparing friend lists
      const mutualFriendsIds = user1.friends.filter(friendId =>
        user2.friends.includes(friendId)
      );
  
      // Fetch mutual friends' information, including id and name
      const mutualFriendsInfo = await userModel.find({ _id: { $in: mutualFriendsIds } })
        .select('_id')
        .select("userName");
  
      res.status(200).json(mutualFriendsInfo);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching mutual friends');
    }
  };  
  
// people you know me===================================
const peopleYouKnowMe = async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Find the user
      const currentUser = await userModel.findById(userId);
  
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Get the current user's friends
      const currentFriends = currentUser.friends;
  
      // Get the current user's sent and received friend requests
      const sentFriendRequests = await FriendRequest.find({ sender: userId });
      const receivedFriendRequests = await FriendRequest.find({ receiver: userId });
  
      // Combine friend requests to get all pending requests
      const allFriendRequests = [...sentFriendRequests, ...receivedFriendRequests];
  
      // Extract user ids from friend requests
      const friendRequestUserIds = allFriendRequests.map(request => request.sender.toString());
  
      // Find people who are not friends and not in friend requests
      const potentialFriends = await userModel.find({
        $and: [
          { _id: { $ne: userId } }, 
          { _id: { $nin: currentFriends } }, 
          { _id: { $nin: friendRequestUserIds } },
        ],
      }).limit(10);
  
      // Simplify the response to only id and userName
      const simplifiedResponse = potentialFriends.map(user => ({
        _id: user._id,
        userName: user.userName,
      }));
  
      res.json(simplifiedResponse);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }; 

module.exports = {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    unfriend,
    getAllFriends,
    getAllFriendRequestsReceived,
    getSentFriendRequests,
    cancelSentFriendRequest,
    findFriends,
    getMutualFriends,
    peopleYouKnowMe
};